import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Core framework: audit logging, notifications, GraphQL (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const email = `core-fw-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";
  let accessToken: string;

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
      .send({ companyName: `Core FW Co ${suffix}`, email, password, firstName: "Core", lastName: "FW" })
      .expect(201);
    accessToken = reg.body.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it("auto-logs an audit entry for a decorated mutation (@AuditEntity) without any explicit call in the controller", async () => {
    const branch = await request(app.getHttpServer())
      .post("/api/v1/branches")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Audit Test Branch", code: `ATB-${suffix}` })
      .expect(201);

    const logs = await prisma.auditLog.findMany({
      where: { entityType: "Branch", entityId: branch.body.id, action: "CREATE" },
    });
    expect(logs.length).toBeGreaterThan(0);
  });

  it("delivers a welcome notification via the domain event bus on registration", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.items.some((n: { title: string }) => n.title === "Welcome to Omniflow")).toBe(true);
  });

  it("marks a notification read via REST and reflects it in the unread count", async () => {
    const before = await request(app.getHttpServer())
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(before.body.count).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .post("/api/v1/notifications/read-all")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    const after = await request(app.getHttpServer())
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(after.body.count).toBe(0);
  });

  it("rejects an unauthenticated GraphQL query", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .send({ query: "{ dashboardSummary { activeUserCount } }" })
      .expect(200);

    expect(res.body.errors?.[0]?.extensions?.code).toBe("UNAUTHENTICATED");
  });

  it("serves the same data over GraphQL as REST, through the same guards", async () => {
    const query = `
      query {
        me { email firstName roles { name } }
        dashboardSummary { activeUserCount totalUserCount branchCount }
        roles { name isSystem permissions { key } }
        branches { name code }
      }
    `;

    const res = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ query })
      .expect(200);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.me.email).toBe(email);
    expect(res.body.data.me.roles).toEqual([{ name: "Super Admin" }]);
    expect(res.body.data.dashboardSummary.activeUserCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.roles[0].permissions.length).toBeGreaterThan(0);
    expect(res.body.data.branches.some((b: { code: string }) => b.code === "HQ")).toBe(true);
  });

  it("enforces @RequirePermissions on GraphQL resolvers the same as REST", async () => {
    // Create a low-privilege teammate (no roles) and confirm they're
    // forbidden from the permission-gated `roles` query.
    const teammateEmail = `core-fw-teammate-${suffix}@test.com`;
    await request(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ email: teammateEmail, password, firstName: "Team", lastName: "Mate" })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: teammateEmail, password })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({ query: "{ roles { name } }" })
      .expect(200);

    expect(res.body.errors?.[0]?.message).toMatch(/Missing required permission/);

    await prisma.user.deleteMany({ where: { email: teammateEmail } });
  });

  it("mutates via GraphQL and sees the effect through REST", async () => {
    const list = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ query: "{ notifications { id readAt } }" })
      .expect(200);

    // Recreate an unread notification to mark read (prior test read-all'd them).
    await prisma.notification.updateMany({
      where: { id: list.body.data.notifications[0].id },
      data: { readAt: null },
    });
    const targetId = list.body.data.notifications[0].id;

    const mutation = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ query: `mutation { markNotificationRead(id: "${targetId}") }` })
      .expect(200);
    expect(mutation.body.data.markNotificationRead).toBe(true);

    const restCheck = await request(app.getHttpServer())
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const updated = restCheck.body.items.find((n: { id: string }) => n.id === targetId);
    expect(updated.readAt).not.toBeNull();
  });
});
