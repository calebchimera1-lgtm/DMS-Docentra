import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Contracts module (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const ownerEmail = `contracts-owner-${suffix}@test.com`;
  const viewerEmail = `contracts-viewer-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";

  let ownerAccess: string;
  let accountId: string;
  let contractId: string;
  let successorId: string;

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
      .send({
        companyName: `Contracts Co ${suffix}`,
        email: ownerEmail,
        password,
        firstName: "Owner",
        lastName: "Test",
      })
      .expect(201);
    ownerAccess = reg.body.accessToken;

    const account = await request(app.getHttpServer())
      .post("/api/v1/crm/accounts")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Acme Corp" })
      .expect(201);
    accountId = account.body.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, viewerEmail] } } });
    await app.close();
  });

  it("creates a draft contract with an auto-generated contract number", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/contracts")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        title: "Annual Support Agreement",
        type: "SERVICE",
        accountId,
        valueCents: 1200000,
        currency: "USD",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        autoRenew: true,
        renewalTermMonths: 12,
      })
      .expect(201);
    contractId = res.body.id;
    expect(res.body.status).toBe("DRAFT");
    expect(res.body.contractNumber).toMatch(/^CON-/);
    expect(res.body.account.name).toBe("Acme Corp");
  });

  it("rejects an end date before the start date", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/contracts")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ title: "Bad dates", startDate: "2026-12-31", endDate: "2026-01-01" })
      .expect(400);
  });

  it("rejects renew/terminate/expire on a DRAFT contract", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/contracts/${contractId}/renew`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ endDate: "2027-12-31" })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/contracts/${contractId}/terminate`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ terminationReason: "Too early" })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/contracts/${contractId}/expire`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("edits and activates the draft contract", async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/contracts/${contractId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ note: "Renewed annually" })
      .expect(200);
    expect(updated.body.note).toBe("Renewed annually");

    const activated = await request(app.getHttpServer())
      .post(`/api/v1/contracts/${contractId}/activate`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(activated.body.status).toBe("ACTIVE");

    await request(app.getHttpServer())
      .post(`/api/v1/contracts/${contractId}/activate`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("rejects editing or deleting an ACTIVE (non-draft) contract", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/contracts/${contractId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ note: "Should fail" })
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/api/v1/contracts/${contractId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);
  });

  it("rejects a renewal end date that does not extend past the current term", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/contracts/${contractId}/renew`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ endDate: "2026-06-30" })
      .expect(400);
  });

  it("renews the active contract, creating a linked successor and marking the original RENEWED", async () => {
    const renewed = await request(app.getHttpServer())
      .post(`/api/v1/contracts/${contractId}/renew`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ endDate: "2027-12-31", valueCents: 1300000 })
      .expect(201);
    successorId = renewed.body.id;
    expect(renewed.body.status).toBe("ACTIVE");
    expect(renewed.body.contractNumber).toMatch(/^CON-/);
    expect(renewed.body.contractNumber).not.toBe(undefined);
    expect(renewed.body.parentContract.id).toBe(contractId);
    expect(renewed.body.valueCents).toBe(1300000);
    expect(new Date(renewed.body.startDate).toISOString().slice(0, 10)).toBe("2026-12-31");

    const original = await request(app.getHttpServer())
      .get(`/api/v1/contracts/${contractId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(original.body.status).toBe("RENEWED");
    expect(original.body.renewedAsContract.id).toBe(successorId);
  });

  it("rejects renewing an already-RENEWED contract", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/contracts/${contractId}/renew`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ endDate: "2028-12-31" })
      .expect(400);
  });

  it("terminates the successor contract with a reason", async () => {
    const terminated = await request(app.getHttpServer())
      .post(`/api/v1/contracts/${successorId}/terminate`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ terminationReason: "Client cancelled the relationship" })
      .expect(201);
    expect(terminated.body.status).toBe("TERMINATED");
    expect(terminated.body.terminationReason).toBe("Client cancelled the relationship");
    expect(terminated.body.terminatedAt).toBeTruthy();
  });

  it("rejects terminate/renew/expire on an already-TERMINATED contract", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/contracts/${successorId}/terminate`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ terminationReason: "Again" })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/contracts/${successorId}/expire`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("requires a termination reason", async () => {
    const draft = await request(app.getHttpServer())
      .post("/api/v1/contracts")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ title: "Another contract", startDate: "2026-01-01", endDate: "2026-12-31" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/contracts/${draft.body.id}/activate`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/contracts/${draft.body.id}/terminate`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({})
      .expect(400);

    const expired = await request(app.getHttpServer())
      .post(`/api/v1/contracts/${draft.body.id}/expire`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(expired.body.status).toBe("EXPIRED");
  });

  it("filters the list by status and search", async () => {
    const byStatus = await request(app.getHttpServer())
      .get("/api/v1/contracts?status=TERMINATED")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(byStatus.body.items.every((c: { status: string }) => c.status === "TERMINATED")).toBe(true);

    const bySearch = await request(app.getHttpServer())
      .get("/api/v1/contracts?search=Annual Support")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(bySearch.body.total).toBeGreaterThanOrEqual(2);
  });

  it("reports summary counts and contracts-by-status breakdown", async () => {
    const summary = await request(app.getHttpServer())
      .get("/api/v1/contracts/reports/summary")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(summary.body.draftCount).toBeGreaterThanOrEqual(0);
    expect(typeof summary.body.totalActiveValueCents).toBe("number");

    const byStatus = await request(app.getHttpServer())
      .get("/api/v1/contracts/reports/by-status")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    const terminated = byStatus.body.find((s: { status: string }) => s.status === "TERMINATED");
    expect(terminated.count).toBeGreaterThanOrEqual(1);
    const renewed = byStatus.body.find((s: { status: string }) => s.status === "RENEWED");
    expect(renewed.count).toBeGreaterThanOrEqual(1);
  });

  it("exports contracts as CSV", async () => {
    const csv = await request(app.getHttpServer())
      .get("/api/v1/contracts/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.text).toContain("Annual Support Agreement");
  });

  it("exposes the same data over GraphQL as REST", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        query: `query { contractsSummary { draftCount activeCount expiringSoonCount totalActiveValueCents } contractsByStatus { status count } contracts(page: 1, pageSize: 10) { total items { contractNumber status } } }`,
      })
      .expect(200);
    expect(res.body.data.contractsSummary).toBeTruthy();
    expect(res.body.data.contractsByStatus.length).toBe(5);
    expect(res.body.data.contracts.total).toBeGreaterThanOrEqual(3);
  });

  it("supports comments via the generic polymorphic Comments module", async () => {
    const comment = await request(app.getHttpServer())
      .post("/api/v1/comments")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ entityType: "Contract", entityId: successorId, body: "Escalated to legal for review" })
      .expect(201);
    expect(comment.body.body).toBe("Escalated to legal for review");

    const list = await request(app.getHttpServer())
      .get(`/api/v1/comments?entityType=Contract&entityId=${successorId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(list.body.some((c: { id: string }) => c.id === comment.body.id)).toBe(true);
  });

  it("enforces RBAC: a role without contracts permissions is forbidden", async () => {
    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "No Contracts", description: "Everything except contracts", permissionKeys: ["users:read"] })
      .expect(201);

    const user = await request(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ email: viewerEmail, password, firstName: "Val", lastName: "Viewer", roleIds: [role.body.id] })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: viewerEmail, password })
      .expect(201);
    const viewerAccess = login.body.accessToken;

    await request(app.getHttpServer())
      .get("/api/v1/contracts")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/contracts")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .send({ title: "Nope", startDate: "2026-01-01", endDate: "2026-12-31" })
      .expect(403);

    await prisma.user.delete({ where: { id: user.body.id } });
  });

  it("enforces tenant isolation: another company cannot see these contracts", async () => {
    const otherEmail = `contracts-isolation-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Other Contracts Co ${suffix}`,
        email: otherEmail,
        password,
        firstName: "Other",
        lastName: "Owner",
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/contracts/${contractId}`)
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get("/api/v1/contracts")
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(200);
    expect(list.body.total).toBe(0);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });
});
