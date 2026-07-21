import { randomBytes, randomUUID, createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { authenticator } from "otplib";
import * as QRCode from "qrcode";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import { CryptoService } from "../../common/crypto/crypto.service";
import type { RegisterDto } from "./dto/register.dto";
import type { LoginDto } from "./dto/login.dto";
import type { VerifyMfaLoginDto } from "./dto/verify-mfa-login.dto";

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const MFA_CHALLENGE_EXPIRES_IN = "5m";
const PASSWORD_RESET_EXPIRES_MINUTES = 60;
const BACKUP_CODE_COUNT = 10;

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
  deviceLabel?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
  ) {}

  async register(dto: RegisterDto, context: RequestContext): Promise<TokenPair> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }

    const slug = await this.generateUniqueCompanySlug(dto.companyName);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const { user, companyId } = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { name: dto.companyName, slug, status: "ACTIVE" },
      });

      const branch = await tx.branch.create({
        data: {
          companyId: company.id,
          name: "Headquarters",
          code: "HQ",
          isHeadquarters: true,
        },
      });

      const permissions = await tx.permission.findMany();
      const superAdminRole = await tx.role.create({
        data: {
          companyId: company.id,
          name: "Super Admin",
          description: "Full access to every module and setting.",
          isSystem: true,
        },
      });
      await tx.rolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId: superAdminRole.id,
          permissionId: permission.id,
        })),
      });

      const createdUser = await tx.user.create({
        data: {
          companyId: company.id,
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
        },
      });

      await tx.userBranch.create({
        data: { userId: createdUser.id, branchId: branch.id, isPrimary: true },
      });
      await tx.userRole.create({
        data: { userId: createdUser.id, roleId: superAdminRole.id, branchId: null },
      });

      const verificationToken = randomBytes(32).toString("hex");
      await tx.emailVerificationToken.create({
        data: {
          userId: createdUser.id,
          tokenHash: this.hashToken(verificationToken),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      return { user: createdUser, companyId: company.id };
    });

    await this.recordAuditLog(companyId, user.id, "CREATE", "Company", companyId, context);

    return this.issueSession(user.id, companyId, user.email, context);
  }

  async login(
    dto: LoginDto,
    context: RequestContext,
  ): Promise<TokenPair | { mfaRequired: true; mfaToken: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        "Account temporarily locked due to repeated failed sign-in attempts. Try again later.",
      );
    }

    if (user.status !== "ACTIVE") {
      throw new UnauthorizedException("This account is not active");
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      await this.registerFailedLogin(user.id, user.failedLoginAttempts);
      await this.recordAuditLog(user.companyId, user.id, "LOGIN_FAILED", "User", user.id, context);
      throw new UnauthorizedException("Invalid email or password");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    if (user.mfaEnabled) {
      const mfaToken = await this.jwt.signAsync(
        { sub: user.id, purpose: "mfa-challenge" },
        { secret: this.config.getOrThrow("JWT_MFA_SECRET"), expiresIn: MFA_CHALLENGE_EXPIRES_IN },
      );
      return { mfaRequired: true, mfaToken };
    }

    return this.issueSession(user.id, user.companyId, user.email, context);
  }

  /**
   * OAuth sign-in only works for an email that already has an Omniflow
   * account — it's an alternative credential for an existing user, not a
   * way to auto-provision new tenants (that stays behind /auth/register).
   * MFA is skipped here since the OAuth provider already performed its
   * own strong authentication.
   */
  async loginWithOAuthEmail(email: string, context: RequestContext): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException(
        "No active Omniflow account found for this email. Register first, then link your OAuth provider.",
      );
    }
    return this.issueSession(user.id, user.companyId, user.email, context);
  }

  async verifyMfaLogin(dto: VerifyMfaLoginDto, context: RequestContext): Promise<TokenPair> {
    let userId: string;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; purpose: string }>(dto.mfaToken, {
        secret: this.config.getOrThrow("JWT_MFA_SECRET"),
      });
      if (payload.purpose !== "mfa-challenge") {
        throw new Error("wrong token purpose");
      }
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException("MFA challenge expired or invalid — please log in again");
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.assertValidMfaCode(user.id, dto.code);

    return this.issueSession(user.id, user.companyId, user.email, context);
  }

  async refresh(userId: string, sessionId: string, context: RequestContext): Promise<TokenPair> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token is no longer valid");
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    return this.issueSession(user.id, user.companyId, user.email, context);
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async listSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        deviceLabel: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { lastUsedAt: "desc" },
    });
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async initiateMfaSetup(userId: string): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.mfaEnabled) {
      throw new BadRequestException("MFA is already enabled");
    }

    const secret = authenticator.generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: this.crypto.encrypt(secret) },
    });

    const otpauthUrl = authenticator.keyuri(user.email, "Omniflow", secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  async confirmMfaSetup(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaSecret) {
      throw new BadRequestException("Call /auth/mfa/setup first");
    }

    const secret = this.crypto.decrypt(user.mfaSecret);
    if (!authenticator.check(code, secret)) {
      throw new UnauthorizedException("Invalid authenticator code");
    }

    const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
      randomBytes(5).toString("hex"),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.mfaBackupCode.deleteMany({ where: { userId } });
      await tx.mfaBackupCode.createMany({
        data: await Promise.all(
          backupCodes.map(async (code) => ({
            userId,
            codeHash: await bcrypt.hash(code, BCRYPT_ROUNDS),
          })),
        ),
      });
      await tx.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    });

    return { backupCodes };
  }

  async disableMfa(userId: string, code: string): Promise<void> {
    await this.assertValidMfaCode(userId, code);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: false, mfaSecret: null },
      }),
      this.prisma.mfaBackupCode.deleteMany({ where: { userId } }),
    ]);
  }

  async forgotPassword(email: string): Promise<{ token?: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always behave the same whether or not the account exists, to avoid
    // leaking which emails are registered.
    if (!user) {
      return {};
    }

    const token = randomBytes(32).toString("hex");
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000),
      },
    });

    // Email delivery lands in Milestone 6 (Email integration). Until then,
    // only surface the raw token outside production so the flow is
    // testable end-to-end.
    if (this.config.get("NODE_ENV") !== "production") {
      this.logger.warn(`Password reset token for ${email}: ${token}`);
      return { token };
    }
    return {};
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const resetToken = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException("This reset link is invalid or has expired");
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash, passwordChangedAt: new Date() },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.session.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  private async assertValidMfaCode(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaSecret) {
      throw new BadRequestException("MFA is not enabled for this account");
    }

    const secret = this.crypto.decrypt(user.mfaSecret);
    if (authenticator.check(code, secret)) {
      return;
    }

    const backupCodes = await this.prisma.mfaBackupCode.findMany({
      where: { userId, usedAt: null },
    });
    for (const backupCode of backupCodes) {
      if (await bcrypt.compare(code, backupCode.codeHash)) {
        await this.prisma.mfaBackupCode.update({
          where: { id: backupCode.id },
          data: { usedAt: new Date() },
        });
        return;
      }
    }

    throw new UnauthorizedException("Invalid authenticator or backup code");
  }

  private async registerFailedLogin(userId: string, currentAttempts: number): Promise<void> {
    const attempts = currentAttempts + 1;
    const lockedUntil =
      attempts >= MAX_FAILED_LOGIN_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
        : null;

    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: attempts, lockedUntil },
    });
  }

  private async issueSession(
    userId: string,
    companyId: string,
    email: string,
    context: RequestContext,
  ): Promise<TokenPair> {
    const sessionId = randomUUID();

    const accessExpiresIn = this.config.get("JWT_ACCESS_EXPIRES_IN", "15m");
    const refreshExpiresIn = this.config.get("JWT_REFRESH_EXPIRES_IN", "7d");

    const accessToken = await this.jwt.signAsync(
      { sub: userId, companyId, email, sessionId },
      { secret: this.config.getOrThrow("JWT_ACCESS_SECRET"), expiresIn: accessExpiresIn },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, sessionId },
      { secret: this.config.getOrThrow("JWT_REFRESH_SECRET"), expiresIn: refreshExpiresIn },
    );

    const decodedRefresh = this.jwt.decode(refreshToken) as { exp: number };
    const decodedAccess = this.jwt.decode(accessToken) as { exp: number };

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId,
        companyId,
        refreshTokenHash: this.hashToken(refreshToken),
        deviceLabel: context.deviceLabel,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        expiresAt: new Date(decodedRefresh.exp * 1000),
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date(), lastLoginIp: context.ipAddress },
    });

    await this.recordAuditLog(companyId, userId, "LOGIN", "Session", sessionId, context);

    return {
      accessToken,
      refreshToken,
      expiresIn: decodedAccess.exp - Math.floor(Date.now() / 1000),
    };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private async generateUniqueCompanySlug(companyName: string): Promise<string> {
    const base = companyName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80) || "company";

    let candidate = base;
    let suffix = 1;
    // Practically never loops more than once or twice; slugs collide rarely.
    while (await this.prisma.company.findUnique({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }

  private async recordAuditLog(
    companyId: string,
    actorId: string | null,
    action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGIN_FAILED" | "LOGOUT" | "PASSWORD_RESET",
    entityType: string,
    entityId: string | null,
    context: RequestContext,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        companyId,
        actorId,
        action,
        entityType,
        entityId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
  }
}
