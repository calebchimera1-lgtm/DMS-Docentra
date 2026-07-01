import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import { v4 as uuid } from 'uuid';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { signAccessToken } from '../../middleware/auth';
import { PERMISSIONS, ROLE_PERMISSION_MAP, SYSTEM_ROLES } from '../../config/permissions';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const PASSWORD_MIN_LENGTH = 10;

export function validatePasswordPolicy(password: string): void {
  const errors: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain a number');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Password must contain a special character');
  if (errors.length) throw ApiError.badRequest('Password does not meet policy requirements', errors);
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function getRolesAndPermissions(userId: string) {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
  const roles = userRoles.map((ur) => ur.role.name);
  const permissions = new Set<string>();
  userRoles.forEach((ur) => ur.role.permissions.forEach((rp) => permissions.add(rp.permission.key)));
  return { roles, permissions: Array.from(permissions) };
}

export async function registerOrganizationAndAdmin(input: {
  organizationName: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) {
  validatePasswordPolicy(input.password);
  const slug = input.organizationName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `org-${Date.now()}`;

  const existingOrg = await prisma.organization.findUnique({ where: { slug } });
  if (existingOrg) throw ApiError.conflict('An organization with a similar name already exists');

  const passwordHash = await bcrypt.hash(input.password, env.bcryptRounds);

  const result = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: { name: input.organizationName, slug },
    });

    // Seed default roles + permissions for the new org
    const roleMap: Record<string, string> = {};
    for (const [roleName, permissionKeys] of Object.entries(ROLE_PERMISSION_MAP)) {
      const role = await tx.role.create({
        data: {
          organizationId: organization.id,
          name: roleName,
          isSystem: true,
        },
      });
      roleMap[roleName] = role.id;

      for (const key of permissionKeys) {
        const permission = await tx.permission.upsert({
          where: { key },
          update: {},
          create: { key, module: key.split(':')[0] },
        });
        await tx.rolePermission.create({
          data: { roleId: role.id, permissionId: permission.id },
        });
      }
    }

    const user = await tx.user.create({
      data: {
        organizationId: organization.id,
        email: input.email.toLowerCase(),
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        emailVerifiedAt: new Date(),
      },
    });

    await tx.userRole.create({
      data: { userId: user.id, roleId: roleMap[SYSTEM_ROLES.SUPER_ADMIN] },
    });

    return { organization, user };
  });

  return result;
}

export async function login(input: {
  organizationSlug?: string;
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
}) {
  const user = await prisma.user.findFirst({
    where: {
      email: input.email.toLowerCase(),
      ...(input.organizationSlug ? { organization: { slug: input.organizationSlug } } : {}),
    },
  });

  if (!user) throw ApiError.unauthorized('Invalid credentials');

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw ApiError.forbidden(`Account locked until ${user.lockedUntil.toISOString()}`);
  }
  if (!user.isActive) throw ApiError.forbidden('Account is disabled');

  const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordValid) {
    const failedAttempts = user.failedLoginAttempts + 1;
    const lockedUntil = failedAttempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: failedAttempts, lockedUntil },
    });
    if (lockedUntil) {
      throw ApiError.forbidden(`Account locked for ${LOCKOUT_MINUTES} minutes after too many failed attempts`);
    }
    throw ApiError.unauthorized('Invalid credentials');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  if (user.mfaEnabled) {
    const mfaChallengeToken = jwt.sign({ sub: user.id, mfaPending: true }, env.jwtAccessSecret, { expiresIn: '5m' });
    return { mfaRequired: true, mfaChallengeToken };
  }

  return issueSessionTokens(user.id, input);
}

export async function verifyMfaAndIssueTokens(input: {
  mfaChallengeToken: string;
  code: string;
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
}) {
  let payload: { sub: string; mfaPending?: boolean };
  try {
    payload = jwt.verify(input.mfaChallengeToken, env.jwtAccessSecret) as typeof payload;
  } catch {
    throw ApiError.unauthorized('MFA challenge expired, please log in again');
  }
  if (!payload.mfaPending) throw ApiError.badRequest('Invalid MFA challenge');

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user?.mfaSecret) throw ApiError.badRequest('MFA is not configured for this account');

  const verified = speakeasy.totp.verify({
    secret: user.mfaSecret,
    encoding: 'base32',
    token: input.code,
    window: 1,
  });

  const isBackupCode = user.mfaBackupCodes.includes(input.code);
  if (!verified && !isBackupCode) throw ApiError.unauthorized('Invalid MFA code');

  if (isBackupCode) {
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaBackupCodes: user.mfaBackupCodes.filter((c) => c !== input.code) },
    });
  }

  return issueSessionTokens(user.id, input);
}

export async function issueSessionTokens(
  userId: string,
  meta: { ipAddress?: string; userAgent?: string; deviceName?: string },
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const { roles, permissions } = await getRolesAndPermissions(userId);

  const session = await prisma.session.create({
    data: {
      userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      deviceName: meta.deviceName ?? 'Unknown device',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const accessToken = signAccessToken({
    sub: user.id,
    organizationId: user.organizationId,
    sessionId: session.id,
    roles,
    permissions,
  });

  const refreshTokenRaw = uuid() + uuid();
  const refreshTokenHash = hashToken(refreshTokenRaw);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      sessionId: session.id,
      tokenHash: refreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    accessToken,
    refreshToken: refreshTokenRaw,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      organizationId: user.organizationId,
      roles,
      permissions,
    },
  };
}

export async function refreshSession(refreshTokenRaw: string) {
  const tokenHash = hashToken(refreshTokenRaw);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    throw ApiError.unauthorized('Refresh token invalid or expired');
  }

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: stored.userId } });
  const { roles, permissions } = await getRolesAndPermissions(user.id);

  const sessionId = stored.sessionId ?? uuid();
  if (stored.sessionId) {
    await prisma.session.update({ where: { id: stored.sessionId }, data: { lastActiveAt: new Date() } });
  }

  const accessToken = signAccessToken({
    sub: user.id,
    organizationId: user.organizationId,
    sessionId,
    roles,
    permissions,
  });

  const newRefreshRaw = uuid() + uuid();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      sessionId: stored.sessionId,
      tokenHash: hashToken(newRefreshRaw),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken, refreshToken: newRefreshRaw };
}

export async function logout(sessionId: string) {
  await prisma.session.update({ where: { id: sessionId }, data: { isActive: false } });
  await prisma.refreshToken.updateMany({ where: { sessionId }, data: { revoked: true } });
}

export async function setupMfa(userId: string) {
  const secret = speakeasy.generateSecret({ name: `${env.mfaIssuer}` });
  await prisma.user.update({ where: { id: userId }, data: { mfaSecret: secret.base32 } });
  return { secret: secret.base32, otpauthUrl: secret.otpauth_url };
}

export async function confirmMfa(userId: string, code: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.mfaSecret) throw ApiError.badRequest('Call setup first');
  const verified = speakeasy.totp.verify({ secret: user.mfaSecret, encoding: 'base32', token: code, window: 1 });
  if (!verified) throw ApiError.badRequest('Invalid MFA code');

  const backupCodes = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex'));
  await prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: true, mfaBackupCodes: backupCodes },
  });
  return { backupCodes };
}

export async function disableMfa(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: [] } });
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findFirst({ where: { email: email.toLowerCase() } });
  if (!user) return; // Do not reveal whether the account exists

  const tokenRaw = uuid() + uuid();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(tokenRaw),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return { userId: user.id, email: user.email, tokenRaw };
}

export async function resetPassword(tokenRaw: string, newPassword: string) {
  validatePasswordPolicy(newPassword);
  const tokenHash = hashToken(tokenRaw);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.used || record.expiresAt < new Date()) {
    throw ApiError.badRequest('Password reset token is invalid or expired');
  }

  const passwordHash = await bcrypt.hash(newPassword, env.bcryptRounds);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash, passwordChangedAt: new Date() } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } }),
    prisma.refreshToken.updateMany({ where: { userId: record.userId }, data: { revoked: true } }),
    prisma.session.updateMany({ where: { userId: record.userId }, data: { isActive: false } }),
  ]);
}
