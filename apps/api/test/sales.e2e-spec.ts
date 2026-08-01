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
  let companyId: string;
  let accountId: string;
  let productId: string;
  let quoteId: string;
  let orderId: string;
  let invoiceId: string;
  let warehouseId: string;

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

    const ownerUser = await prisma.user.findUniqueOrThrow({ where: { email: ownerEmail } });
    companyId = ownerUser.companyId;

    const account = await request(app.getHttpServer())
      .post("/api/v1/crm/accounts")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Sales Test Account" })
      .expect(201);
    accountId = account.body.id;

    const warehouse = await request(app.getHttpServer())
      .post("/api/v1/inventory/warehouses")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Main Warehouse", code: "MAIN" })
      .expect(201);
    warehouseId = warehouse.body.id;
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

  it("auto-provisions a chart of accounts on company registration", async () => {
    const accounts = await prisma.ledgerAccount.findMany({ where: { companyId } });
    expect(accounts.length).toBeGreaterThan(0);
    expect(accounts.map((a) => a.code)).toEqual(expect.arrayContaining(["1100", "4000"]));
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

  it("rejects fulfilling without a warehouse, then fulfills and deducts stock", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/inventory/movements`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ productId, warehouseId, type: "RECEIPT", quantity: 100, note: "Opening stock" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/sales/orders/${orderId}/fulfill`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({})
      .expect(400);

    // Direct status edits can't bypass fulfillment's stock deduction.
    await request(app.getHttpServer())
      .patch(`/api/v1/sales/orders/${orderId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ status: "FULFILLED" })
      .expect(400);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/sales/orders/${orderId}/fulfill`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ warehouseId })
      .expect(201);
    expect(res.body.status).toBe("FULFILLED");

    const stockItem = await prisma.stockItem.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    });
    expect(stockItem?.quantityOnHand).toBe(90); // 100 opening - 10 ordered

    const movements = await prisma.stockMovement.findMany({ where: { companyId, productId, type: "SALE" } });
    expect(movements).toHaveLength(1);
    expect(movements[0]?.quantity).toBe(-10);

    // Already fulfilled — can't fulfill twice.
    await request(app.getHttpServer())
      .post(`/api/v1/sales/orders/${orderId}/fulfill`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({})
      .expect(400);
  });

  it("converts a sales order into an invoice exactly once, posting the receivable to the ledger", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/sales/orders/${orderId}/convert-to-invoice`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    invoiceId = res.body.id;
    expect(res.body.invoiceNumber).toMatch(/^INV-\d{6}$/);
    expect(res.body.totalCents).toBe(25500);
    expect(res.body.status).toBe("DRAFT");
    expect(res.body.dueDate).toBeTruthy();

    const entry = await prisma.journalEntry.findFirst({
      where: { companyId, memo: `Invoice ${res.body.invoiceNumber}` },
      include: { lines: { include: { ledgerAccount: true } } },
    });
    expect(entry).not.toBeNull();
    expect(entry?.status).toBe("POSTED");
    const receivableLine = entry?.lines.find((l) => l.ledgerAccount.code === "1100");
    const revenueLine = entry?.lines.find((l) => l.ledgerAccount.code === "4000");
    expect(receivableLine?.debitCents).toBe(25500);
    expect(revenueLine?.creditCents).toBe(25500);

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
