import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Sales module (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const ownerEmail = `sales-owner-${suffix}@test.com`;
  const viewerEmail = `sales-viewer-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";

  let ownerAccess: string;
  let accountId: string;
  let productId: string;
  let quoteId: string;
  let orderId: string;
  let invoiceId: string;

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
      .send({ companyName: `Sales Co ${suffix}`, email: ownerEmail, password, firstName: "Owner", lastName: "Test" })
      .expect(201);
    ownerAccess = reg.body.accessToken;

    const account = await request(app.getHttpServer())
      .post("/api/v1/crm/accounts")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Sales Test Account" })
      .expect(201);
    accountId = account.body.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, viewerEmail] } } });
    await app.close();
  });

  it("creates a product", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/sales/products")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ sku: "WIDGET-1", name: "Widget", unitPriceCents: 2500 })
      .expect(201);
    productId = res.body.id;
    expect(res.body.sku).toBe("WIDGET-1");
  });

  it("rejects a duplicate SKU within the same company", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/sales/products")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ sku: "WIDGET-1", name: "Widget Duplicate", unitPriceCents: 1000 })
      .expect(409);
  });

  it("creates a quote and computes totals from line items", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/sales/quotes")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        accountId,
        items: [{ productId, description: "Widget x10", quantity: 10, unitPriceCents: 2500 }],
        taxCents: 500,
      })
      .expect(201);
    quoteId = res.body.id;
    expect(res.body.quoteNumber).toMatch(/^Q-\d{6}$/);
    expect(res.body.status).toBe("DRAFT");
    expect(res.body.subtotalCents).toBe(25000);
    expect(res.body.totalCents).toBe(25500);
  });

  it("refuses to convert a draft quote, only an accepted one", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/sales/quotes/${quoteId}/convert-to-order`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/sales/quotes/${quoteId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ status: "SENT" })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/sales/quotes/${quoteId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ status: "ACCEPTED" })
      .expect(200);
  });

  it("converts an accepted quote into a sales order exactly once", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/sales/quotes/${quoteId}/convert-to-order`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    orderId = res.body.id;
    expect(res.body.orderNumber).toMatch(/^SO-\d{6}$/);
    expect(res.body.totalCents).toBe(25500);
    expect(res.body.status).toBe("DRAFT");

    await request(app.getHttpServer())
      .post(`/api/v1/sales/quotes/${quoteId}/convert-to-order`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("converts a sales order into an invoice exactly once", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/sales/orders/${orderId}/convert-to-invoice`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    invoiceId = res.body.id;
    expect(res.body.invoiceNumber).toMatch(/^INV-\d{6}$/);
    expect(res.body.totalCents).toBe(25500);
    expect(res.body.status).toBe("DRAFT");
    expect(res.body.dueDate).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/api/v1/sales/orders/${orderId}/convert-to-invoice`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("marks an invoice paid exactly once", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/sales/invoices/${invoiceId}/mark-paid`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(res.body.status).toBe("PAID");
    expect(res.body.paidAt).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/api/v1/sales/invoices/${invoiceId}/mark-paid`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("reports booked/collected revenue and invoice status breakdown", async () => {
    const summary = await request(app.getHttpServer())
      .get("/api/v1/sales/reports/summary")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(summary.body.revenueBookedCents).toBe(25500);
    expect(summary.body.revenueCollectedCents).toBe(25500);

    const byStatus = await request(app.getHttpServer())
      .get("/api/v1/sales/reports/invoices-by-status")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    const paid = byStatus.body.statuses.find((s: { status: string }) => s.status === "PAID");
    expect(paid.count).toBe(1);
    expect(paid.totalCents).toBe(25500);
  });

  it("exports products and invoices as CSV", async () => {
    const productsCsv = await request(app.getHttpServer())
      .get("/api/v1/sales/products/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(productsCsv.headers["content-type"]).toContain("text/csv");
    expect(productsCsv.text).toContain("WIDGET-1");

    const invoicesCsv = await request(app.getHttpServer())
      .get("/api/v1/sales/invoices/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(invoicesCsv.text).toContain("PAID");
  });

  it("exposes the same data over GraphQL as REST", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        query: `query { salesSummary { revenueCollectedCents } quotes(page: 1, pageSize: 10) { total items { quoteNumber status account { name } } } invoices(page: 1, pageSize: 10, status: "PAID") { total items { invoiceNumber status } } }`,
      })
      .expect(200);
    expect(res.body.data.salesSummary.revenueCollectedCents).toBe(25500);
    expect(res.body.data.quotes.total).toBe(1);
    expect(res.body.data.quotes.items[0].account.name).toBe("Sales Test Account");
    expect(res.body.data.invoices.items[0].status).toBe("PAID");
  });

  it("enforces RBAC: a role without sales permissions is forbidden", async () => {
    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "No Sales", description: "Everything except sales", permissionKeys: ["users:read"] })
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
      .get("/api/v1/sales/products")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/sales/quotes")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .send({ accountId, items: [{ description: "x", quantity: 1, unitPriceCents: 100 }] })
      .expect(403);

    await prisma.user.delete({ where: { id: user.body.id } });
  });

  it("enforces tenant isolation: another company cannot see these sales records", async () => {
    const otherEmail = `sales-other-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Other Sales Co ${suffix}`,
        email: otherEmail,
        password,
        firstName: "Other",
        lastName: "Owner",
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/sales/products/${productId}`)
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get("/api/v1/sales/quotes")
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(200);
    expect(list.body.total).toBe(0);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });

  it("soft-deletes a product", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/sales/products/${productId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/sales/products/${productId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(404);
  });
});
