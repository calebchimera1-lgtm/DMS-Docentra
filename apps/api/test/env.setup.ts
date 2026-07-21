/** Default env vars for tests, so specs don't need a real .env file. CI/local
 * env vars (e.g. a real DATABASE_URL) still take precedence when already set. */
const defaults: Record<string, string> = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://omniflow:omniflow@localhost:5432/omniflow_test?schema=public",
  JWT_ACCESS_SECRET: "test-access-secret",
  JWT_REFRESH_SECRET: "test-refresh-secret",
  JWT_MFA_SECRET: "test-mfa-secret",
  JWT_ACCESS_EXPIRES_IN: "15m",
  JWT_REFRESH_EXPIRES_IN: "7d",
  ENCRYPTION_KEY: "test-encryption-key-not-for-production",
};

for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}
