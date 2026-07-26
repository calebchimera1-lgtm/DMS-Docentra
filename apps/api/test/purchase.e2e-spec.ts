import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Purchase module (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const ownerEmail = `purchase-owner-${suffix}@test.com`;
  const viewerEmail = `purchase-viewer-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";

  let ownerAccess: string;
  let supplierId: string;
  let warehouseId: string;
  let productId: string;
  let orderId: string;

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
        companyName: `Purchase Co ${suffix}`,
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
      .send({ sku: "WIDGET-1", name: "Widget", unitPriceCents: 2500 })
      .expect(201);
    productId = product.body.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, viewerEmail] } } });
    await app.close();
  });

  it("creates a supplier and rejects a duplicate code", async () => {
    const supplier = await request(app.getHttpServer())
      .post("/api/v1/purchase/suppliers")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Acme Wholesale", code: "ACME" })
      .expect(201);
    supplierId = supplier.body.id;

    await request(app.getHttpServer())
      .post("/api/v1/purchase/suppliers")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Duplicate", code: "ACME" })
      .expect(409);
  });

  it("creates a draft purchase order and rejects a supplier/warehouse from another company", async () => {
    const order = await request(app.getHttpServer())
      .post("/api/v1/purchase/orders")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        supplierId,
        warehouseId,
        items: [{ productId, description: "Widgets x100", quantity: 100, unitPriceCents: 1000 }],
      })
      .expect(201);
    orderId = order.body.id;
    expect(order.body.orderNumber).toMatch(/^PO-\d{6}$/);
    expect(order.body.status).toBe("DRAFT");
    expect(order.body.totalCents).toBe(100000);

    await request(app.getHttpServer())
      .post("/api/v1/purchase/orders")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        supplierId: "00000000-0000-0000-0000-000000000000",
        warehouseId,
        items: [{ description: "Ghost", quantity: 1, unitPriceCents: 100 }],
      })
      .expect(400);
  });

  it("rejects receiving a non-CONFIRMED order", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/purchase/orders/${orderId}/receive`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("walks the order DRAFT -> SENT -> CONFIRMED, then receives it and posts stock", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/purchase/orders/${orderId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ status: "SENT" })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/purchase/orders/${orderId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ status: "CONFIRMED" })
      .expect(200);

    const receipt = await request(app.getHttpServer())
      .post(`/api/v1/purchase/orders/${orderId}/receive`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(receipt.body.receiptNumber).toMatch(/^GR-\d{6}$/);

    const order = await request(app.getHttpServer())
      .get(`/api/v1/purchase/orders/${orderId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(order.body.status).toBe("RECEIVED");

    const stock = await request(app.getHttpServer())
      .get(`/api/v1/inventory/stock?warehouseId=${warehouseId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    const item = stock.body.items.find((i: { product: { id: string } }) => i.product.id === productId);
    expect(item.quantityOnHand).toBe(100);

    const movements = await request(app.getHttpServer())
      .get(`/api/v1/inventory/movements?warehouseId=${warehouseId}&type=RECEIPT`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(movements.body.items).toHaveLength(1);
    expect(movements.body.items[0].quantity).toBe(100);
    expect(movements.body.items[0].reference).toBe(order.body.orderNumber);
  });

  it("rejects receiving the same order twice and editing a received order", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/purchase/orders/${orderId}/receive`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/purchase/orders/${orderId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ currency: "EUR" })
      .expect(400);
  });

  it("blocks deleting a supplier with purchase orders, and a received order", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/purchase/suppliers/${supplierId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/purchase/orders/${orderId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);
  });

  it("reports committed spend and open orders, correctly excluding the now-received order", async () => {
    const draft = await request(app.getHttpServer())
      .post("/api/v1/purchase/orders")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        supplierId,
        warehouseId,
        items: [{ description: "Second order", quantity: 10, unitPriceCents: 500 }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/purchase/orders/${draft.body.id}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ status: "SENT" })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/purchase/orders/${draft.body.id}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ status: "CONFIRMED" })
      .expect(200);

    const summary = await request(app.getHttpServer())
      .get("/api/v1/purchase/reports/summary")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(summary.body.supplierCount).toBe(1);
    expect(summary.body.openOrderCount).toBe(1);
    expect(summary.body.committedSpendCents).toBe(5000);
    expect(summary.body.receivedOrderCount).toBe(1);

    const byStatus = await request(app.getHttpServer())
      .get("/api/v1/purchase/reports/orders-by-status")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    const confirmed = byStatus.body.find((s: { status: string }) => s.status === "CONFIRMED");
    expect(confirmed.count).toBe(1);
  });

  it("exports suppliers and purchase orders as CSV", async () => {
    const suppliersCsv = await request(app.getHttpServer())
      .get("/api/v1/purchase/suppliers/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(suppliersCsv.headers["content-type"]).toContain("text/csv");
    expect(suppliersCsv.text).toContain("Acme Wholesale");

    const ordersCsv = await request(app.getHttpServer())
      .get("/api/v1/purchase/orders/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(ordersCsv.text).toContain("RECEIVED");
  });

  it("exposes the same data over GraphQL as REST", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        query: `query { purchaseSummary { supplierCount receivedOrderCount } suppliers(page: 1, pageSize: 10) { total } purchaseOrders(page: 1, pageSize: 10) { total items { orderNumber status supplier { name } } } }`,
      })
      .expect(200);
    expect(res.body.data.purchaseSummary.supplierCount).toBe(1);
    expect(res.body.data.suppliers.total).toBe(1);
    expect(res.body.data.purchaseOrders.total).toBe(2);
  });

  it("enforces RBAC: a role without purchase permissions is forbidden", async () => {
    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "No Purchase", description: "Everything except purchase", permissionKeys: ["users:read"] })
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
      .get("/api/v1/purchase/orders")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/purchase/suppliers")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .send({ name: "Nope", code: "NOPE" })
      .expect(403);

    await prisma.user.delete({ where: { id: user.body.id } });
  });

  it("enforces tenant isolation: another company cannot see these purchase records", async () => {
    const otherEmail = `purchase-other-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Other Purchase Co ${suffix}`,
        email: otherEmail,
        password,
        firstName: "Other",
        lastName: "Owner",
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/purchase/suppliers/${supplierId}`)
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get("/api/v1/purchase/orders")
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(200);
    expect(list.body.total).toBe(0);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });
});
