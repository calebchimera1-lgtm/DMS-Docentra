import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Users & RBAC (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const ownerEmail = `rbac-owner-${suffix}@test.com`;
  const viewerEmail = `rbac-viewer-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";

  let ownerAccess: string;
  let hqBranchId: string;
  let viewerRoleId: string;
  let viewerUserId: string;

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
      .send({ companyName: `RBAC Co ${suffix}`, email: ownerEmail, password, firstName: "Owner", lastName: "Test" })
      .expect(201);
    ownerAccess = reg.body.accessToken;

    const branches = await request(app.getHttpServer())
      .get("/api/v1/branches")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    hqBranchId = branches.body[0].id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, viewerEmail] } } });
    await app.close();
  });

  it("bootstraps a company with a Super Admin holding every permission", async () => {
    const me = await request(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);

    expect(me.body.email).toBe(ownerEmail);
    const permissions = await request(app.getHttpServer())
      .get("/api/v1/permissions")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(me.body.effectivePermissions.length).toBe(permissions.body.length);
  });

  it("creates a custom role and a user holding only that role", async () => {
    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Viewer", description: "Read-only", permissionKeys: ["users:read"] })
      .expect(201);
    viewerRoleId = role.body.id;

    const user = await request(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        email: viewerEmail,
        password,
        firstName: "Val",
        lastName: "Viewer",
        branchIds: [hqBranchId],
        roleIds: [viewerRoleId],
      })
      .expect(201);
    viewerUserId = user.body.id;
  });

  it("enforces least privilege: the viewer can read but not write", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: viewerEmail, password })
      .expect(201);
    const viewerAccess = login.body.accessToken;

    await request(app.getHttpServer())
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .send({ email: `blocked-${suffix}@test.com`, password, firstName: "X", lastName: "Y" })
      .expect(403);

    await request(app.getHttpServer())
      .get("/api/v1/roles")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);
  });

  it("re-evaluates permissions live: granting a permission takes effect on the viewer's existing token", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: viewerEmail, password })
      .expect(201);
    const viewerAccess = login.body.accessToken;

    await request(app.getHttpServer())
      .get("/api/v1/branches")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/roles/${viewerRoleId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ permissionKeys: ["users:read", "branches:manage"] })
      .expect(200);

    await request(app.getHttpServer())
      .get("/api/v1/branches")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(200);
  });

  it("protects system roles from modification and deletion", async () => {
    const roles = await request(app.getHttpServer())
      .get("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    const superAdmin = roles.body.find((r: { name: string }) => r.name === "Super Admin");

    await request(app.getHttpServer())
      .patch(`/api/v1/roles/${superAdmin.id}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Hacked" })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/roles/${superAdmin.id}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);
  });

  it("blocks deleting a role that still has active grants, and a branch with assigned users", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/roles/${viewerRoleId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(409);

    await request(app.getHttpServer())
      .delete(`/api/v1/branches/${hqBranchId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403); // headquarters branch specifically
  });

  it("blocks self-deletion and enforces tenant isolation on user lookups", async () => {
    const me = await request(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/users/${me.body.id}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);

    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Other Co ${suffix}`,
        email: `other-owner-${suffix}@test.com`,
        password,
        firstName: "Other",
        lastName: "Owner",
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/users/${viewerUserId}`)
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(404);

    await prisma.user.deleteMany({ where: { email: `other-owner-${suffix}@test.com` } });
  });

  it("deactivating a user immediately revokes their session", async () => {
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: viewerEmail, password })
      .expect(201);
    const viewerAccess = login.body.accessToken;

    await request(app.getHttpServer())
      .delete(`/api/v1/users/${viewerUserId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(204);

    await request(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(401);
  });
});
