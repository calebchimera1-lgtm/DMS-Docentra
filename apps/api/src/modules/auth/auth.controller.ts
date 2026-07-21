import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { RequestUser } from "./interfaces/jwt-payload.interface";
import { AuthService, RequestContext } from "./auth.service";
import { ConfirmMfaSetupDto } from "./dto/confirm-mfa-setup.dto";
import { DisableMfaDto } from "./dto/disable-mfa.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { VerifyMfaLoginDto } from "./dto/verify-mfa-login.dto";
import { JwtRefreshGuard } from "./guards/jwt-refresh.guard";
import type { RefreshTokenRequestUser } from "./strategies/jwt-refresh.strategy";

function requestContext(req: Request): RequestContext {
  return {
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
    deviceLabel: (req.body as { deviceLabel?: string } | undefined)?.deviceLabel,
  };
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("register")
  @ApiOperation({ summary: "Register a new company and its first (Super Admin) user" })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, requestContext(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  @ApiOperation({ summary: "Log in with email/password; may return an MFA challenge instead of tokens" })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, requestContext(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("mfa/verify")
  @ApiOperation({ summary: "Complete login by verifying a TOTP/backup code against an MFA challenge" })
  verifyMfaLogin(@Body() dto: VerifyMfaLoginDto, @Req() req: Request) {
    return this.authService.verifyMfaLogin(dto, requestContext(req));
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("refresh")
  @ApiOperation({ summary: "Exchange a refresh token for a new token pair (rotates the session)" })
  @ApiBody({ type: RefreshTokenDto })
  refresh(@Req() req: Request & { user: RefreshTokenRequestUser }) {
    return this.authService.refresh(req.user.sub, req.user.sessionId, requestContext(req));
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("logout")
  @ApiOperation({ summary: "Revoke the current session" })
  async logout(@CurrentUser() user: RequestUser): Promise<void> {
    await this.authService.logout(user.sessionId);
  }

  @ApiBearerAuth()
  @Get("sessions")
  @ApiOperation({ summary: "List this user's active sessions (device/session management)" })
  listSessions(@CurrentUser() user: RequestUser) {
    return this.authService.listSessions(user.id);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("sessions/:id")
  @ApiOperation({ summary: "Revoke a specific session (e.g. sign out a lost device)" })
  async revokeSession(@CurrentUser() user: RequestUser, @Param("id") sessionId: string): Promise<void> {
    await this.authService.revokeSession(user.id, sessionId);
  }

  @ApiBearerAuth()
  @Post("mfa/setup")
  @ApiOperation({ summary: "Begin TOTP MFA enrollment: returns a secret + QR code to scan" })
  initiateMfaSetup(@CurrentUser() user: RequestUser) {
    return this.authService.initiateMfaSetup(user.id);
  }

  @ApiBearerAuth()
  @Post("mfa/setup/confirm")
  @ApiOperation({ summary: "Confirm TOTP enrollment with a code; returns one-time backup codes" })
  confirmMfaSetup(@CurrentUser() user: RequestUser, @Body() dto: ConfirmMfaSetupDto) {
    return this.authService.confirmMfaSetup(user.id, dto.code);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("mfa/disable")
  @ApiOperation({ summary: "Disable MFA (requires a valid TOTP or backup code)" })
  async disableMfa(@CurrentUser() user: RequestUser, @Body() dto: DisableMfaDto): Promise<void> {
    await this.authService.disableMfa(user.id, dto.code);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("password/forgot")
  @ApiOperation({ summary: "Request a password reset link (always returns 200 to avoid email enumeration)" })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("password/reset")
  @ApiOperation({ summary: "Reset password with a token from /auth/password/forgot" })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
  }
}
