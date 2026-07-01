import { Router } from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import * as controller from './auth.controller';

export const authRouter = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

authRouter.post(
  '/register',
  [
    body('organizationName').isString().trim().isLength({ min: 2 }),
    body('email').isEmail(),
    body('password').isString().isLength({ min: 10 }),
    body('firstName').isString().trim().notEmpty(),
    body('lastName').isString().trim().notEmpty(),
  ],
  validate,
  controller.register,
);

authRouter.post(
  '/login',
  loginLimiter,
  [body('email').isEmail(), body('password').isString().notEmpty()],
  validate,
  controller.login,
);

authRouter.post('/login/mfa', loginLimiter, [body('mfaChallengeToken').isString(), body('code').isString()], validate, controller.verifyMfaLogin);

authRouter.post('/refresh', [body('refreshToken').isString()], validate, controller.refresh);

authRouter.post('/logout', authenticate, controller.logout);

authRouter.post('/mfa/setup', authenticate, controller.setupMfa);
authRouter.post('/mfa/confirm', authenticate, [body('code').isString()], validate, controller.confirmMfa);
authRouter.post('/mfa/disable', authenticate, controller.disableMfa);

authRouter.post('/forgot-password', loginLimiter, [body('email').isEmail()], validate, controller.forgotPassword);
authRouter.post(
  '/reset-password',
  [body('token').isString(), body('newPassword').isString().isLength({ min: 10 })],
  validate,
  controller.resetPassword,
);

authRouter.get('/me', authenticate, controller.me);
authRouter.get('/sessions', authenticate, controller.listSessions);
authRouter.delete('/sessions/:sessionId', authenticate, controller.revokeSession);
