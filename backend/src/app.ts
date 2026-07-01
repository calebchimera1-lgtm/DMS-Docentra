import './utils/bigintSerialization';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { router } from './routes';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(
    morgan('combined', {
      stream: { write: (message) => logger.info(message.trim()) },
      skip: () => env.nodeEnv === 'test',
    }),
  );

  const globalLimiter = rateLimit({
    windowMs: env.rateLimitWindowMs,
    max: env.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', globalLimiter);

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'docentra-backend', time: new Date().toISOString() }));

  app.use('/api/v1', router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
