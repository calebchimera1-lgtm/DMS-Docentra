import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { recordAudit } from '../../utils/audit';
import { sendEmail } from '../../utils/email';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import * as authService from './auth.service';

function requestMeta(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] as string | undefined,
    deviceName: (req.headers['x-device-name'] as string | undefined) ?? undefined,
  };
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { organizationName, email, password, firstName, lastName } = req.body;
  const { organization, user } = await authService.registerOrganizationAndAdmin({
    organizationName,
    email,
    password,
    firstName,
    lastName,
  });
  await recordAudit(req, { organizationId: organization.id, userId: user.id, action: 'auth.register', resourceType: 'user', resourceId: user.id });
  res.status(201).json({ success: true, data: { organizationId: organization.id, organizationSlug: organization.slug, userId: user.id } });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, organizationSlug } = req.body;
  const result = await authService.login({ email, password, organizationSlug, ...requestMeta(req) });

  if ('mfaRequired' in result) {
    return res.json({ success: true, data: result });
  }

  await recordAudit(req, { organizationId: result.user.organizationId, userId: result.user.id, action: 'auth.login' });
  res.json({ success: true, data: result });
});

export const verifyMfaLogin = asyncHandler(async (req: Request, res: Response) => {
  const { mfaChallengeToken, code } = req.body;
  const result = await authService.verifyMfaAndIssueTokens({ mfaChallengeToken, code, ...requestMeta(req) });
  await recordAudit(req, { organizationId: result.user.organizationId, userId: result.user.id, action: 'auth.login.mfa' });
  res.json({ success: true, data: result });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw ApiError.badRequest('refreshToken is required');
  const result = await authService.refreshSession(refreshToken);
  res.json({ success: true, data: result });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user) {
    await authService.logout(req.user.sessionId);
    await recordAudit(req, { organizationId: req.user.organizationId, userId: req.user.sub, action: 'auth.logout' });
  }
  res.json({ success: true });
});

export const setupMfa = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.setupMfa(req.user!.sub);
  res.json({ success: true, data: result });
});

export const confirmMfa = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body;
  const result = await authService.confirmMfa(req.user!.sub, code);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'auth.mfa.enabled' });
  res.json({ success: true, data: result });
});

export const disableMfa = asyncHandler(async (req: Request, res: Response) => {
  await authService.disableMfa(req.user!.sub);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'auth.mfa.disabled' });
  res.json({ success: true });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const result = await authService.requestPasswordReset(email);
  if (result) {
    const resetUrl = `${env.webUrl}/reset-password?token=${result.tokenRaw}`;
    await sendEmail(result.email, 'Docentra password reset', `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`);
  }
  res.json({ success: true, message: 'If an account exists for that email, a reset link has been sent.' });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  await authService.resetPassword(token, newPassword);
  res.json({ success: true });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.sub },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      mfaEnabled: true,
      organizationId: true,
      departmentId: true,
      branchId: true,
      lastLoginAt: true,
    },
  });
  res.json({ success: true, data: { ...user, roles: req.user!.roles, permissions: req.user!.permissions } });
});

export const listSessions = asyncHandler(async (req: Request, res: Response) => {
  const sessions = await prisma.session.findMany({
    where: { userId: req.user!.sub, isActive: true },
    orderBy: { lastActiveAt: 'desc' },
  });
  res.json({ success: true, data: sessions });
});

export const revokeSession = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = await prisma.session.findFirst({ where: { id: sessionId, userId: req.user!.sub } });
  if (!session) throw ApiError.notFound('Session not found');
  await authService.logout(sessionId);
  res.json({ success: true });
});
