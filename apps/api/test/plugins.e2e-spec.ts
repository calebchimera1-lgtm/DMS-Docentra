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

  it("lists the seeded plugin catalog, including both MODULE (app registry) and INTEGRATION entries", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/plugins")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.some((p: { key: string }) => p.key === "webhook-notifier")).toBe(true);
    expect(res.body.some((p: { key: string; kind: string }) => p.key === "crm" && p.kind === "MODULE")).toBe(true);
  });

  it("auto-installs every MODULE app (but no integrations) for a freshly registered company", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/plugins/installed")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body).toHaveLength(21);
    expect(res.body.every((cp: { isEnabled: boolean }) => cp.isEnabled)).toBe(true);
    expect(res.body.every((cp: { plugin: { kind: string } }) => cp.plugin.kind === "MODULE")).toBe(true);
    expect(res.body.some((cp: { plugin: { key: string } }) => cp.plugin.key === "webhook-notifier")).toBe(false);
  });

  it("drives the sidebar from installed apps + permissions via GET /plugins/nav", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/plugins/nav")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);

    // The registering owner holds every permission, so every installed
    // MODULE app is visible, sorted, dashboard first (no permission gate).
    expect(res.body).toHaveLength(21);
    expect(res.body[0]).toMatchObject({ key: "dashboard", route: "/dashboard" });
    expect(res.body.map((i: { key: string }) => i.key)).toContain("crm");

    // Uninstalling a module removes it from nav immediately.
    await request(app.getHttpServer())
      .post("/api/v1/plugins/crm/disable")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(204);
    const afterDisable = await request(app.getHttpServer())
      .get("/api/v1/plugins/nav")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    expect(afterDisable.body.map((i: { key: string }) => i.key)).not.toContain("crm");

    await request(app.getHttpServer())
      .post("/api/v1/plugins/crm/enable")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({})
      .expect(201);
  });

  it("nav only shows modules the current user has <module>:read for", async () => {
    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "CRM Only", description: "Just CRM", permissionKeys: ["crm:read"] })
      .expect(201);
    const teammateEmail = `plugins-nav-${suffix}@test.com`;
    const user = await request(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: teammateEmail, password, firstName: "Nav", lastName: "User", roleIds: [role.body.id] })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: teammateEmail, password })
      .expect(201);

    const nav = await request(app.getHttpServer())
      .get("/api/v1/plugins/nav")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .expect(200);
    const keys = nav.body.map((i: { key: string }) => i.key);
    expect(keys).toContain("dashboard"); // no permission gate
    expect(keys).toContain("crm");
    expect(keys).not.toContain("sales");

    await prisma.user.delete({ where: { id: user.body.id } });
  });

  it("enables the webhook-notifier integration with config, then reflects it in the installed list", async () => {
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
    const webhook = installed.body.find((cp: { plugin: { key: string } }) => cp.plugin.key === "webhook-notifier");
    expect(webhook.isEnabled).toBe(true);
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
    const webhook = installed.body.find((cp: { plugin: { key: string } }) => cp.plugin.key === "webhook-notifier");
    expect(webhook.isEnabled).toBe(false);
    expect(webhook.config).toEqual({ webhookUrl: "https://example.com/hook" });
  });

  it("404s enabling an unknown plugin key", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/plugins/not-a-real-plugin/enable")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({})
      .expect(404);
  });

  it("requires settings:manage for the full catalog — a low-privilege user is forbidden", async () => {
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

    // /plugins/nav has no such gate — anyone authenticated can fetch their own nav.
    await request(app.getHttpServer())
      .get("/api/v1/plugins/nav")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .expect(200);

    await prisma.user.deleteMany({ where: { email: teammateEmail } });
  });
});
