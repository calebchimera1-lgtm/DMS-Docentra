import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  appUrl: process.env.APP_URL ?? 'http://localhost:4000',
  webUrl: process.env.WEB_URL ?? 'http://localhost:5173',

  databaseUrl: required('DATABASE_URL', 'postgresql://docentra:docentra@localhost:5432/docentra'),

  jwtAccessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',

  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),

  mfaIssuer: process.env.MFA_ISSUER ?? 'Docentra',

  storageDriver: (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 's3',
  localStoragePath: process.env.LOCAL_STORAGE_PATH ?? 'uploads',
  s3Bucket: process.env.S3_BUCKET ?? 'docentra-documents',
  s3Region: process.env.S3_REGION ?? 'us-east-1',
  s3Endpoint: process.env.S3_ENDPOINT, // set for MinIO
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',

  smtpHost: process.env.SMTP_HOST,
  smtpPort: parseInt(process.env.SMTP_PORT ?? '587', 10),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  smtpFrom: process.env.SMTP_FROM ?? 'Docentra <no-reply@docentra.local>',

  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '900000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX ?? '300', 10),

  maxUploadSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB ?? '200', 10),

  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),
};
