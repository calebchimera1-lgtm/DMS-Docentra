import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Plugins (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const ownerEmail = `plugins-owner-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";
  let ownerToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    const reg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ companyName: `Plugins Co ${suffix}`, email: ownerEmail, password, firstName: "Own", lastName: "Er" })
      .expect(201);
    ownerToken = reg.body.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: ownerEmail } });
    await app.close();
  });

  it("lists the seeded plugin catalog", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/plugins")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.some((p: { key: string }) => p.key === "webhook-notifier")).toBe(true);
  });

  it("starts with nothing installed for a fresh company", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/plugins/installed")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it("enables a plugin with config, then reflects it in the installed list", async () => {
    const enable = await request(app.getHttpServer())
      .post("/api/v1/plugins/webhook-notifier/enable")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ config: { webhookUrl: "https://example.com/hook" } })
      .expect(201);
    expect(enable.body.isEnabled).toBe(true);
    expect(enable.body.config).toEqual({ webhookUrl: "https://example.com/hook" });

    const installed = await request(app.getHttpServer())
      .get("/api/v1/plugins/installed")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    expect(installed.body[0].plugin.key).toBe("webhook-notifier");
    expect(installed.body[0].isEnabled).toBe(true);
  });

  it("disables a plugin, preserving its config for re-enabling", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/plugins/webhook-notifier/disable")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(204);

    const installed = await request(app.getHttpServer())
      .get("/api/v1/plugins/installed")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    expect(installed.body[0].isEnabled).toBe(false);
    expect(installed.body[0].config).toEqual({ webhookUrl: "https://example.com/hook" });
  });

  it("404s enabling an unknown plugin key", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/plugins/not-a-real-plugin/enable")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({})
      .expect(404);
  });

  it("requires settings:manage — a low-privilege user is forbidden", async () => {
    const teammateEmail = `plugins-teammate-${suffix}@test.com`;
    await request(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: teammateEmail, password, firstName: "Team", lastName: "Mate" })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: teammateEmail, password })
      .expect(201);

    await request(app.getHttpServer())
      .get("/api/v1/plugins")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .expect(403);

    await prisma.user.deleteMany({ where: { email: teammateEmail } });
  });
});
