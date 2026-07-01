import request from 'supertest';
import { createApp } from '../src/app';

export const app = createApp();

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

export function uniqueOrgName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export async function registerOrgAndLogin(orgName: string) {
  const email = uniqueEmail('admin');
  const password = 'SuperSecret123!';
  const uniqueOrgName = `${orgName} ${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const registerRes = await request(app).post('/api/v1/auth/register').send({
    organizationName: uniqueOrgName,
    email,
    password,
    firstName: 'Test',
    lastName: 'Admin',
  });

  if (registerRes.status !== 201) {
    throw new Error(`Register failed: ${JSON.stringify(registerRes.body)}`);
  }

  const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
  }

  return {
    email,
    password,
    accessToken: loginRes.body.data.accessToken as string,
    refreshToken: loginRes.body.data.refreshToken as string,
    user: loginRes.body.data.user,
  };
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
