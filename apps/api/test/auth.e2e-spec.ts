import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { authenticator } from "otplib";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const email = `e2e-${Date.now()}@test.com`;
  const password = "Correct-Horse-Battery-9!";

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it("registers a new company + user and returns a token pair", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ companyName: "E2E Test Co", email, password, firstName: "E2E", lastName: "Test" })
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
  });

  it("rejects a duplicate registration", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ companyName: "Dupe Co", email, password, firstName: "E2E", lastName: "Test" })
      .expect(409);
  });

  it("rejects login with the wrong password", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: "wrong-password" })
      .expect(401);
  });

  it("logs in with correct credentials and rotates tokens on refresh", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(201);

    const { accessToken, refreshToken } = login.body;

    const sessions = await request(app.getHttpServer())
      .get("/api/v1/auth/sessions")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(sessions.body.length).toBeGreaterThan(0);

    const refreshed = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken })
      .expect(201);
    expect(refreshed.body.accessToken).not.toEqual(accessToken);

    // Old refresh token was rotated out and must no longer work.
    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken })
      .expect(401);
  });

  it("blocks requests without a token, and logout revokes the session immediately", async () => {
    await request(app.getHttpServer()).get("/api/v1/auth/sessions").expect(401);

    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(201);
    const { accessToken } = login.body;

    await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get("/api/v1/auth/sessions")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(401);
  });

  it("enrolls MFA, then requires a TOTP code to complete subsequent logins", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(201);
    const { accessToken } = login.body;

    const setup = await request(app.getHttpServer())
      .post("/api/v1/auth/mfa/setup")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);
    const secret = setup.body.secret;

    await request(app.getHttpServer())
      .post("/api/v1/auth/mfa/setup/confirm")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ code: authenticator.generate(secret) })
      .expect(201);

    const mfaLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(201);
    expect(mfaLogin.body.mfaRequired).toBe(true);

    const verified = await request(app.getHttpServer())
      .post("/api/v1/auth/mfa/verify")
      .send({ mfaToken: mfaLogin.body.mfaToken, code: authenticator.generate(secret) })
      .expect(201);
    expect(verified.body.accessToken).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .post("/api/v1/auth/mfa/disable")
      .set("Authorization", `Bearer ${verified.body.accessToken}`)
      .send({ code: authenticator.generate(secret) })
      .expect(204);
  });

  it("resets a forgotten password end-to-end", async () => {
    const forgot = await request(app.getHttpServer())
      .post("/api/v1/auth/password/forgot")
      .send({ email })
      .expect(200);
    expect(forgot.body.token).toEqual(expect.any(String));

    const newPassword = "New-Correct-Horse-9!";
    await request(app.getHttpServer())
      .post("/api/v1/auth/password/reset")
      .send({ token: forgot.body.token, newPassword })
      .expect(204);

    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(401);

    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: newPassword })
      .expect(201);
  });
});
