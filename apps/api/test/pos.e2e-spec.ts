import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("POS module (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const ownerEmail = `pos-owner-${suffix}@test.com`;
  const viewerEmail = `pos-viewer-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";

  let ownerAccess: string;
  let warehouseId: string;
  let productId: string;
  let sessionId: string;
  let saleId: string;

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
        companyName: `POS Co ${suffix}`,
        email: ownerEmail,
        password,
        firstName: "Owner",
        lastName: "Test",
      })
      .expect(201);
    ownerAccess = reg.body.accessToken;

    const warehouse = await request(app.getHttpServer())
      .post("/api/v1/inventory/warehouses")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Main Warehouse", code: "MAIN" })
      .expect(201);
    warehouseId = warehouse.body.id;

    const product = await request(app.getHttpServer())
      .post("/api/v1/sales/products")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ sku: "MUG-1", name: "Coffee Mug", unitPriceCents: 1500 })
      .expect(201);
    productId = product.body.id;

    await request(app.getHttpServer())
      .post("/api/v1/inventory/movements")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ productId, warehouseId, type: "RECEIPT", quantity: 50 })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, viewerEmail] } } });
    await app.close();
  });

  it("rejects ringing up a sale without an open session", async () => {
    // sessionId is a random UUID that doesn't exist yet
    await request(app.getHttpServer())
      .post("/api/v1/pos/sales")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        sessionId: "00000000-0000-0000-0000-000000000000",
        items: [{ productId, description: "Coffee Mug", quantity: 1, unitPriceCents: 1500 }],
        paymentMethod: "CASH",
        amountTenderedCents: 1500,
      })
      .expect(400);
  });

  it("opens a register session and rejects opening a second one for the same warehouse", async () => {
    const session = await request(app.getHttpServer())
      .post("/api/v1/pos/sessions")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ warehouseId, openingFloatCents: 10000 })
      .expect(201);
    sessionId = session.body.id;
    expect(session.body.status).toBe("OPEN");
    expect(session.body.sessionNumber).toMatch(/^REG-/);

    await request(app.getHttpServer())
      .post("/api/v1/pos/sessions")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ warehouseId })
      .expect(400);
  });

  it("rejects a cash sale with insufficient amount tendered", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/pos/sales")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        sessionId,
        items: [{ productId, description: "Coffee Mug", quantity: 2, unitPriceCents: 1500 }],
        paymentMethod: "CASH",
        amountTenderedCents: 1000,
      })
      .expect(400);
  });

  it("rejects a sale that needs more stock than is on hand", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/pos/sales")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        sessionId,
        items: [{ productId, description: "Coffee Mug", quantity: 100, unitPriceCents: 1500 }],
        paymentMethod: "CASH",
        amountTenderedCents: 200000,
      })
      .expect(400);

    const stock = await request(app.getHttpServer())
      .get(`/api/v1/inventory/stock?productId=${productId}&warehouseId=${warehouseId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(stock.body.items[0].quantityOnHand).toBe(50);
  });

  it("rings up a cash sale, deducting stock and computing change", async () => {
    const sale = await request(app.getHttpServer())
      .post("/api/v1/pos/sales")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        sessionId,
        items: [{ productId, description: "Coffee Mug", quantity: 3, unitPriceCents: 1500 }],
        paymentMethod: "CASH",
        amountTenderedCents: 5000,
      })
      .expect(201);
    saleId = sale.body.id;
    expect(sale.body.status).toBe("COMPLETED");
    expect(sale.body.saleNumber).toMatch(/^POS-/);
    expect(sale.body.totalCents).toBe(4500);
    expect(sale.body.changeDueCents).toBe(500);

    const stock = await request(app.getHttpServer())
      .get(`/api/v1/inventory/stock?productId=${productId}&warehouseId=${warehouseId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(stock.body.items[0].quantityOnHand).toBe(47);

    const movements = await request(app.getHttpServer())
      .get("/api/v1/inventory/movements?type=SALE")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    const thisMovement = movements.body.items.find((m: { reference: string }) => m.reference === sale.body.saleNumber);
    expect(thisMovement.quantity).toBe(-3);
  });

  it("voids the sale while the session is open, restocking the items", async () => {
    const voided = await request(app.getHttpServer())
      .post(`/api/v1/pos/sales/${saleId}/void`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ voidReason: "Rang up by mistake" })
      .expect(201);
    expect(voided.body.status).toBe("VOIDED");
    expect(voided.body.voidReason).toBe("Rang up by mistake");

    const stock = await request(app.getHttpServer())
      .get(`/api/v1/inventory/stock?productId=${productId}&warehouseId=${warehouseId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(stock.body.items[0].quantityOnHand).toBe(50);

    const returnMovements = await request(app.getHttpServer())
      .get("/api/v1/inventory/movements?type=RETURN")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(returnMovements.body.items[0].quantity).toBe(3);
  });

  it("rejects voiding or refunding an already-voided sale", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/pos/sales/${saleId}/void`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ voidReason: "Again" })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/pos/sales/${saleId}/refund`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ refundReason: "Again" })
      .expect(400);
  });

  it("rejects voiding a completed sale once its session is closed, but still allows a refund", async () => {
    const sale = await request(app.getHttpServer())
      .post("/api/v1/pos/sales")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        sessionId,
        items: [{ productId, description: "Coffee Mug", quantity: 1, unitPriceCents: 1500 }],
        paymentMethod: "CARD",
      })
      .expect(201);
    expect(sale.body.amountTenderedCents).toBeNull();
    expect(sale.body.changeDueCents).toBeNull();

    const closed = await request(app.getHttpServer())
      .post(`/api/v1/pos/sessions/${sessionId}/close`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ countedCashCents: 10000 })
      .expect(201);
    expect(closed.body.status).toBe("CLOSED");
    // opening float 10000 + 0 CASH completed sales (the only completed sale left is CARD) = 10000 expected
    expect(closed.body.expectedCashCents).toBe(10000);
    expect(closed.body.countedCashCents).toBe(10000);
    expect(closed.body.cashDifferenceCents).toBe(0);

    await request(app.getHttpServer())
      .post(`/api/v1/pos/sales/${sale.body.id}/void`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ voidReason: "Too late" })
      .expect(400);

    const refunded = await request(app.getHttpServer())
      .post(`/api/v1/pos/sales/${sale.body.id}/refund`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ refundReason: "Customer returned it" })
      .expect(201);
    expect(refunded.body.status).toBe("REFUNDED");
  });

  it("rejects closing an already-closed session and recording a sale against it", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/pos/sessions/${sessionId}/close`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ countedCashCents: 10000 })
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/v1/pos/sales")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        sessionId,
        items: [{ productId, description: "Coffee Mug", quantity: 1, unitPriceCents: 1500 }],
        paymentMethod: "CASH",
        amountTenderedCents: 1500,
      })
      .expect(400);
  });

  it("reports summary counts and sales-by-payment-method breakdown", async () => {
    const summary = await request(app.getHttpServer())
      .get("/api/v1/pos/reports/summary")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(summary.body.voidedCount).toBeGreaterThanOrEqual(1);
    expect(summary.body.refundedCount).toBeGreaterThanOrEqual(1);
    expect(summary.body.openSessionCount).toBe(0);

    const byMethod = await request(app.getHttpServer())
      .get("/api/v1/pos/reports/by-payment-method")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(byMethod.body).toHaveLength(4);
  });

  it("exports sessions and sales as CSV", async () => {
    const sessionsCsv = await request(app.getHttpServer())
      .get("/api/v1/pos/sessions/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(sessionsCsv.headers["content-type"]).toContain("text/csv");
    expect(sessionsCsv.text).toContain("CLOSED");

    const salesCsv = await request(app.getHttpServer())
      .get("/api/v1/pos/sales/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(salesCsv.text).toContain("VOIDED");
  });

  it("exposes the same data over GraphQL as REST", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        query: `query { posSummary { voidedCount refundedCount } posSalesByPaymentMethod { paymentMethod count } posSessions(page:1,pageSize:10) { total items { sessionNumber status } } posSales(page:1,pageSize:10) { total items { saleNumber status } } }`,
      })
      .expect(200);
    expect(res.body.data.posSummary.voidedCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.posSalesByPaymentMethod).toHaveLength(4);
    expect(res.body.data.posSessions.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data.posSales.total).toBeGreaterThanOrEqual(2);
  });

  it("enforces RBAC: a role without pos permissions is forbidden", async () => {
    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "No POS", description: "Everything except pos", permissionKeys: ["users:read"] })
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
      .get("/api/v1/pos/sessions")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/pos/sessions")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .send({ warehouseId })
      .expect(403);

    await prisma.user.delete({ where: { id: user.body.id } });
  });

  it("enforces tenant isolation: another company cannot see these sessions or sales", async () => {
    const otherEmail = `pos-isolation-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Other POS Co ${suffix}`,
        email: otherEmail,
        password,
        firstName: "Other",
        lastName: "Owner",
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/pos/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get("/api/v1/pos/sales")
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(200);
    expect(list.body.total).toBe(0);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });
});
