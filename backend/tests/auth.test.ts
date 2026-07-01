import request from 'supertest';
import { app, authHeader, registerOrgAndLogin, uniqueEmail, uniqueOrgName } from './helpers';

describe('Auth module', () => {
  it('registers a new organization with a Super Admin user', async () => {
    const email = uniqueEmail('reg');
    const res = await request(app).post('/api/v1/auth/register').send({
      organizationName: uniqueOrgName('Acme Corp'),
      email,
      password: 'SuperSecret123!',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.organizationSlug).toBeDefined();
  });

  it('rejects registration with a weak password', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      organizationName: uniqueOrgName('Weak Password Co'),
      email: uniqueEmail('weak'),
      password: 'weak',
      firstName: 'A',
      lastName: 'B',
    });
    expect(res.status).toBe(400);
  });

  it('logs in with valid credentials and returns an access token', async () => {
    const { accessToken } = await registerOrgAndLogin('Login Test Co');
    expect(accessToken).toBeTruthy();
  });

  it('rejects login with invalid credentials', async () => {
    const email = uniqueEmail('badlogin');
    await request(app).post('/api/v1/auth/register').send({
      organizationName: uniqueOrgName('Bad Login Co'),
      email,
      password: 'SuperSecret123!',
      firstName: 'Test',
      lastName: 'User',
    });

    const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'WrongPassword123!' });
    expect(res.status).toBe(401);
  });

  it('locks the account after too many failed login attempts', async () => {
    const email = uniqueEmail('lockout');
    await request(app).post('/api/v1/auth/register').send({
      organizationName: uniqueOrgName('Lockout Co'),
      email,
      password: 'SuperSecret123!',
      firstName: 'Test',
      lastName: 'User',
    });

    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/v1/auth/login').send({ email, password: 'WrongPassword123!' });
    }

    const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'SuperSecret123!' });
    expect(res.status).toBe(403);
  });

  it('returns the authenticated user profile via /auth/me', async () => {
    const { accessToken, user } = await registerOrgAndLogin('Me Endpoint Co');
    const res = await request(app).get('/api/v1/auth/me').set(authHeader(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(user.id);
    expect(res.body.data.roles).toContain('Super Admin');
  });

  it('rejects requests without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('refreshes the access token using a valid refresh token', async () => {
    const { refreshToken } = await registerOrgAndLogin('Refresh Co');
    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('sets up and confirms MFA, then requires a code at login', async () => {
    const { accessToken, email, password } = await registerOrgAndLogin('MFA Co');

    const setupRes = await request(app).post('/api/v1/auth/mfa/setup').set(authHeader(accessToken));
    expect(setupRes.status).toBe(200);
    expect(setupRes.body.data.secret).toBeTruthy();

    const speakeasy = require('speakeasy');
    const code = speakeasy.totp({ secret: setupRes.body.data.secret, encoding: 'base32' });

    const confirmRes = await request(app).post('/api/v1/auth/mfa/confirm').set(authHeader(accessToken)).send({ code });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.backupCodes.length).toBeGreaterThan(0);

    const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.mfaRequired).toBe(true);

    const mfaCode = speakeasy.totp({ secret: setupRes.body.data.secret, encoding: 'base32' });
    const verifyRes = await request(app)
      .post('/api/v1/auth/login/mfa')
      .send({ mfaChallengeToken: loginRes.body.data.mfaChallengeToken, code: mfaCode });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.accessToken).toBeTruthy();
  });
});
