import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export interface AccessTokenPayload {
  sub: string; // userId
  organizationId: string;
  sessionId: string;
  roles: string[];
  permissions: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: jwt.SignOptions = { expiresIn: env.jwtAccessExpiresIn as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, env.jwtAccessSecret, options);
}

export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing access token');
  }
  const token = header.slice('Bearer '.length);

  let payload: AccessTokenPayload;
  try {
    payload = jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token');
  }

  const session = await prisma.session.findUnique({ where: { id: payload.sessionId } });
  if (!session || !session.isActive || session.expiresAt < new Date()) {
    throw ApiError.unauthorized('Session has expired or been revoked');
  }

  req.user = payload;
  next();
});

export function requirePermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const has = permissions.some((p) => req.user!.permissions.includes(p));
    if (!has) {
      throw ApiError.forbidden(`Missing required permission: ${permissions.join(' or ')}`);
    }
    next();
  };
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const has = roles.some((r) => req.user!.roles.includes(r));
    if (!has) {
      throw ApiError.forbidden(`Missing required role: ${roles.join(' or ')}`);
    }
    next();
  };
}
