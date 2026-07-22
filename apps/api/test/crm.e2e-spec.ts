import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("CRM module (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const ownerEmail = `crm-owner-${suffix}@test.com`;
  const viewerEmail = `crm-viewer-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";

  let ownerAccess: string;
  let accountId: string;
  let contactId: string;
  let dealId: string;
  let leadId: string;

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
      .send({ companyName: `CRM Co ${suffix}`, email: ownerEmail, password, firstName: "Owner", lastName: "Test" })
      .expect(201);
    ownerAccess = reg.body.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, viewerEmail] } } });
    await app.close();
  });

  it("creates a CRM account", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/crm/accounts")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Acme Corp", industry: "Manufacturing" })
      .expect(201);
    accountId = res.body.id;
    expect(res.body.name).toBe("Acme Corp");
  });

  it("creates a contact linked to the account", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/crm/contacts")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ firstName: "Jane", lastName: "Doe", email: "jane@acme.test", accountId })
      .expect(201);
    contactId = res.body.id;
    expect(res.body.accountId).toBe(accountId);
  });

  it("rejects a contact linked to an account from another company", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/crm/contacts")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ firstName: "Bad", lastName: "Link", accountId: "00000000-0000-0000-0000-000000000000" })
      .expect(404);
  });

  it("creates a deal and moves it through pipeline stages", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/crm/deals")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ title: "Acme Renewal", valueCents: 500000, accountId, contactId })
      .expect(201);
    dealId = res.body.id;
    expect(res.body.stage).toBe("PROSPECTING");

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/crm/deals/${dealId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ stage: "NEGOTIATION" })
      .expect(200);
    expect(updated.body.stage).toBe("NEGOTIATION");
  });

  it("fetches a single account with its contacts and deals nested", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/crm/accounts/${accountId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(res.body.contacts).toHaveLength(1);
    expect(res.body.deals).toHaveLength(1);
  });

  it("creates and converts a lead into an account + contact", async () => {
    const lead = await request(app.getHttpServer())
      .post("/api/v1/crm/leads")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ firstName: "Bob", lastName: "Smith", companyName: "NewCo Inc", source: "referral" })
      .expect(201);
    leadId = lead.body.id;
    expect(lead.body.status).toBe("NEW");

    const converted = await request(app.getHttpServer())
      .post(`/api/v1/crm/leads/${leadId}/convert`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(converted.body.lead.status).toBe("CONVERTED");
    expect(converted.body.account.name).toBe("NewCo Inc");
    expect(converted.body.contact.firstName).toBe("Bob");

    await request(app.getHttpServer())
      .post(`/api/v1/crm/leads/${leadId}/convert`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("reports pipeline totals and lead funnel counts", async () => {
    const pipeline = await request(app.getHttpServer())
      .get("/api/v1/crm/reports/pipeline")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    const negotiation = pipeline.body.stages.find((s: { stage: string }) => s.stage === "NEGOTIATION");
    expect(negotiation.count).toBe(1);
    expect(negotiation.totalValueCents).toBe(500000);
    expect(pipeline.body.openPipelineValueCents).toBe(500000);

    const funnel = await request(app.getHttpServer())
      .get("/api/v1/crm/reports/leads-funnel")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    const converted = funnel.body.statuses.find((s: { status: string }) => s.status === "CONVERTED");
    expect(converted.count).toBe(1);

    const summary = await request(app.getHttpServer())
      .get("/api/v1/crm/reports/summary")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(summary.body.accountCount).toBe(2);
    expect(summary.body.openDealCount).toBe(1);
  });

  it("exports accounts as CSV", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/crm/accounts/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.text).toContain("Acme Corp");
    expect(res.text.split("\n")[0]).toBe("id,name,industry,website,phone,createdAt");
  });

  it("supports comments on a CRM deal via the generic comments endpoint", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/comments")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ entityType: "CrmDeal", entityId: dealId, body: "Client requested a discount." })
      .expect(201);
    expect(created.body.author.firstName).toBe("Owner");

    const list = await request(app.getHttpServer())
      .get(`/api/v1/comments?entityType=CrmDeal&entityId=${dealId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it("exposes the same data over GraphQL as REST", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        query: `query { crmSummary { accountCount openDealCount } crmDeals(page: 1, pageSize: 10, search: "Acme") { total items { id stage account { name } } } }`,
      })
      .expect(200);
    expect(res.body.data.crmSummary.accountCount).toBe(2);
    expect(res.body.data.crmDeals.total).toBe(1);
    expect(res.body.data.crmDeals.items[0].account.name).toBe("Acme Corp");
  });

  it("enforces RBAC: a role without CRM permissions is forbidden", async () => {
    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "No CRM", description: "Everything except CRM", permissionKeys: ["users:read"] })
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
      .get("/api/v1/crm/accounts")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/crm/accounts")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .send({ name: "Should Fail" })
      .expect(403);

    await prisma.user.delete({ where: { id: user.body.id } });
  });

  it("enforces tenant isolation: another company cannot see these CRM records", async () => {
    const otherEmail = `crm-other-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ companyName: `Other CRM Co ${suffix}`, email: otherEmail, password, firstName: "Other", lastName: "Owner" })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/crm/accounts/${accountId}`)
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get("/api/v1/crm/accounts")
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(200);
    expect(list.body.total).toBe(0);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });

  it("soft-deletes a CRM account", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/crm/accounts/${accountId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/crm/accounts/${accountId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(404);
  });
});
