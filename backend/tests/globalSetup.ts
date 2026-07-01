import { execSync } from 'child_process';
import { TEST_DATABASE_URL } from './testDbUrl';

// Runs exactly once in the main Jest process before any worker starts, avoiding
// concurrent `prisma migrate deploy` invocations racing against each other
// when multiple test files would otherwise each try to migrate in their own beforeAll.
export default function globalSetup(): void {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
