// Runs before any test module (or app source) is imported so env.ts picks up the test database.
import { TEST_DATABASE_URL } from './testDbUrl';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.STORAGE_DRIVER = 'local';
process.env.LOCAL_STORAGE_PATH = 'tests/tmp-uploads';
process.env.RATE_LIMIT_MAX = '100000';
