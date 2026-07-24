import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Inventory module (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const ownerEmail = `inventory-owner-${suffix}@test.com`;
  const viewerEmail = `inventory-viewer-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";

  let ownerAccess: string;
  let productId: string;
  let warehouseId: string;
  let stockItemId: string;

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
        companyName: `Inventory Co ${suffix}`,
        email: ownerEmail,
        password,
        firstName: "Owner",
        lastName: "Test",
      })
      .expect(201);
    ownerAccess = reg.body.accessToken;

    const product = await request(app.getHttpServer())
      .post("/api/v1/sales/products")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ sku: "GADGET-1", name: "Gadget", unitPriceCents: 1000 })
      .expect(201);
    productId = product.body.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, viewerEmail] } } });
    await app.close();
  });

  it("creates a warehouse and rejects a duplicate code", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/inventory/warehouses")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Main Warehouse", code: "WH-1" })
      .expect(201);
    warehouseId = res.body.id;

    await request(app.getHttpServer())
      .post("/api/v1/inventory/warehouses")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Duplicate", code: "WH-1" })
      .expect(409);
  });

  it("refuses to sell stock that doesn't exist yet", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/inventory/movements")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ productId, warehouseId, type: "SALE", quantity: 5 })
      .expect(400);
  });

  it("records a receipt and creates the stock item automatically", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/inventory/movements")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ productId, warehouseId, type: "RECEIPT", quantity: 20, reference: "PO-1001" })
      .expect(201);
    expect(res.body.quantity).toBe(20);

    const stock = await request(app.getHttpServer())
      .get(`/api/v1/inventory/stock?warehouseId=${warehouseId}&productId=${productId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(stock.body.items).toHaveLength(1);
    expect(stock.body.items[0].quantityOnHand).toBe(20);
    stockItemId = stock.body.items[0].id;
  });

  it("records a sale and refuses to oversell", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/inventory/movements")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ productId, warehouseId, type: "SALE", quantity: 15 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post("/api/v1/inventory/movements")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ productId, warehouseId, type: "SALE", quantity: 10 })
      .expect(400);
    expect(res.body.message).toContain("Insufficient stock");
  });

  it("sets a reorder point and surfaces the item via the low-stock filter", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/inventory/stock/${stockItemId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ reorderPoint: 10 })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get("/api/v1/inventory/stock?lowStock=true")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(res.body.items.some((i: { id: string }) => i.id === stockItemId)).toBe(true);
  });

  it("applies a signed adjustment", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/inventory/movements")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ productId, warehouseId, type: "ADJUSTMENT", quantity: -2, note: "Cycle count shrinkage" })
      .expect(201);
    expect(res.body.quantity).toBe(-2);

    const stock = await request(app.getHttpServer())
      .get(`/api/v1/inventory/stock/${stockItemId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(stock.body.quantityOnHand).toBe(3);
  });

  it("reports stock value, low-stock count, and movement breakdown", async () => {
    const summary = await request(app.getHttpServer())
      .get("/api/v1/inventory/reports/summary")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(summary.body.totalUnitsOnHand).toBe(3);
    expect(summary.body.totalStockValueCents).toBe(3000);
    expect(summary.body.lowStockCount).toBe(1);

    const byType = await request(app.getHttpServer())
      .get("/api/v1/inventory/reports/movements-by-type")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    const receipt = byType.body.types.find((t: { type: string }) => t.type === "RECEIPT");
    const sale = byType.body.types.find((t: { type: string }) => t.type === "SALE");
    expect(receipt.count).toBe(1);
    expect(sale.count).toBe(1);
  });

  it("exports stock and movements as CSV", async () => {
    const stockCsv = await request(app.getHttpServer())
      .get("/api/v1/inventory/stock/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(stockCsv.headers["content-type"]).toContain("text/csv");
    expect(stockCsv.text).toContain("GADGET-1");

    const movementsCsv = await request(app.getHttpServer())
      .get("/api/v1/inventory/movements/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(movementsCsv.text).toContain("RECEIPT");
  });

  it("exposes the same data over GraphQL as REST", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        query: `query { inventorySummary { totalUnitsOnHand lowStockCount } stockItems(page: 1, pageSize: 10, lowStock: true) { total items { quantityOnHand product { sku } } } }`,
      })
      .expect(200);
    expect(res.body.data.inventorySummary.totalUnitsOnHand).toBe(3);
    expect(res.body.data.stockItems.items[0].product.sku).toBe("GADGET-1");
  });

  it("refuses to delete a warehouse that still holds stock", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/inventory/warehouses/${warehouseId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);
  });

  it("enforces RBAC: a role without inventory permissions is forbidden", async () => {
    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "No Inventory", description: "Everything except inventory", permissionKeys: ["users:read"] })
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
      .get("/api/v1/inventory/warehouses")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/inventory/movements")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .send({ productId, warehouseId, type: "RECEIPT", quantity: 1 })
      .expect(403);

    await prisma.user.delete({ where: { id: user.body.id } });
  });

  it("enforces tenant isolation: another company cannot see these inventory records", async () => {
    const otherEmail = `inventory-other-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Other Inventory Co ${suffix}`,
        email: otherEmail,
        password,
        firstName: "Other",
        lastName: "Owner",
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/inventory/warehouses/${warehouseId}`)
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get("/api/v1/inventory/stock")
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(200);
    expect(list.body.total).toBe(0);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });
});
