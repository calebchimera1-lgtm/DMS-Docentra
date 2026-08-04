import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Manufacturing module (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const ownerEmail = `manufacturing-owner-${suffix}@test.com`;
  const viewerEmail = `manufacturing-viewer-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";

  let ownerAccess: string;
  let warehouseId: string;
  let componentId: string;
  let finishedId: string;
  let bomId: string;
  let workOrderId: string;

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
        companyName: `Manufacturing Co ${suffix}`,
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

    const component = await request(app.getHttpServer())
      .post("/api/v1/sales/products")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ sku: "STEEL-SHEET-1", name: "Steel Sheet", unitPriceCents: 500 })
      .expect(201);
    componentId = component.body.id;

    const finished = await request(app.getHttpServer())
      .post("/api/v1/sales/products")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ sku: "WIDGET-FRAME-1", name: "Widget Frame", unitPriceCents: 4000 })
      .expect(201);
    finishedId = finished.body.id;

    await request(app.getHttpServer())
      .post("/api/v1/inventory/movements")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ productId: componentId, warehouseId, type: "RECEIPT", quantity: 100 })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, viewerEmail] } } });
    await app.close();
  });

  it("rejects a BOM where the finished product is its own component", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/manufacturing/boms")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ productId: finishedId, name: "Bad Recipe", lines: [{ componentProductId: finishedId, quantity: 1 }] })
      .expect(400);
  });

  it("creates a BOM with component lines", async () => {
    const bom = await request(app.getHttpServer())
      .post("/api/v1/manufacturing/boms")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        productId: finishedId,
        name: "Widget Frame Recipe",
        lines: [{ componentProductId: componentId, quantity: 4 }],
      })
      .expect(201);
    bomId = bom.body.id;
    expect(bom.body.lines).toHaveLength(1);
    expect(bom.body.lines[0].quantity).toBe(4);
    expect(bom.body.product.sku).toBe("WIDGET-FRAME-1");
  });

  it("replaces a BOM's lines on update", async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/manufacturing/boms/${bomId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ lines: [{ componentProductId: componentId, quantity: 5 }] })
      .expect(200);
    expect(updated.body.lines).toHaveLength(1);
    expect(updated.body.lines[0].quantity).toBe(5);

    // restore to quantity 4 for the rest of the suite's math
    await request(app.getHttpServer())
      .patch(`/api/v1/manufacturing/boms/${bomId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ lines: [{ componentProductId: componentId, quantity: 4 }] })
      .expect(200);
  });

  it("rejects starting a work order that needs more stock than is on hand", async () => {
    const wo = await request(app.getHttpServer())
      .post("/api/v1/manufacturing/work-orders")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ bomId, warehouseId, quantity: 30 })
      .expect(201);
    expect(wo.body.status).toBe("DRAFT");
    expect(wo.body.workOrderNumber).toMatch(/^WO-/);

    // 30 * 4 = 120 needed, only 100 on hand
    await request(app.getHttpServer())
      .post(`/api/v1/manufacturing/work-orders/${wo.body.id}/start`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);

    const stock = await request(app.getHttpServer())
      .get(`/api/v1/inventory/stock?productId=${componentId}&warehouseId=${warehouseId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(stock.body.items[0].quantityOnHand).toBe(100);

    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/manufacturing/work-orders/${wo.body.id}/cancel`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(cancelled.body.status).toBe("CANCELLED");
  });

  it("rejects cancelling a non-draft work order", async () => {
    const wo = await request(app.getHttpServer())
      .post("/api/v1/manufacturing/work-orders")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ bomId, warehouseId, quantity: 1 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/manufacturing/work-orders/${wo.body.id}/start`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/manufacturing/work-orders/${wo.body.id}/cancel`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
    // leave it IN_PROGRESS; not touching shared component stock further here since quantity is 1 (needs 4, fine)
  });

  it("starts a work order, consuming component stock and posting a PRODUCTION_CONSUME movement", async () => {
    const wo = await request(app.getHttpServer())
      .post("/api/v1/manufacturing/work-orders")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ bomId, warehouseId, quantity: 10 })
      .expect(201);
    workOrderId = wo.body.id;

    const started = await request(app.getHttpServer())
      .post(`/api/v1/manufacturing/work-orders/${workOrderId}/start`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(started.body.status).toBe("IN_PROGRESS");
    expect(started.body.startedAt).toBeTruthy();

    // 100 on hand - 4 (from the IN_PROGRESS work order in the previous test) - 40 (this one) = 56
    const stock = await request(app.getHttpServer())
      .get(`/api/v1/inventory/stock?productId=${componentId}&warehouseId=${warehouseId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(stock.body.items[0].quantityOnHand).toBe(56);

    const movements = await request(app.getHttpServer())
      .get(`/api/v1/inventory/movements?type=PRODUCTION_CONSUME`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    const thisMovement = movements.body.items.find((m: { reference: string }) => m.reference === wo.body.workOrderNumber);
    expect(thisMovement.quantity).toBe(-40);
  });

  it("rejects starting an already-started work order", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/manufacturing/work-orders/${workOrderId}/start`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("rejects editing or deleting a non-draft work order", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/manufacturing/work-orders/${workOrderId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ note: "Should fail" })
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/api/v1/manufacturing/work-orders/${workOrderId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);
  });

  it("completes an in-progress work order, posting the finished-good yield", async () => {
    const completed = await request(app.getHttpServer())
      .post(`/api/v1/manufacturing/work-orders/${workOrderId}/complete`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(completed.body.status).toBe("COMPLETED");
    expect(completed.body.completedAt).toBeTruthy();

    const stock = await request(app.getHttpServer())
      .get(`/api/v1/inventory/stock?productId=${finishedId}&warehouseId=${warehouseId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(stock.body.items[0].quantityOnHand).toBe(10);

    const movements = await request(app.getHttpServer())
      .get(`/api/v1/inventory/movements?type=PRODUCTION_YIELD`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(movements.body.items[0].quantity).toBe(10);
  });

  it("rejects completing an already-completed work order", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/manufacturing/work-orders/${workOrderId}/complete`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("filters work orders by status", async () => {
    const completedList = await request(app.getHttpServer())
      .get("/api/v1/manufacturing/work-orders?status=COMPLETED")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(completedList.body.items.every((w: { status: string }) => w.status === "COMPLETED")).toBe(true);
    expect(completedList.body.total).toBeGreaterThanOrEqual(1);
  });

  it("reports summary counts and work-orders-by-status breakdown", async () => {
    const summary = await request(app.getHttpServer())
      .get("/api/v1/manufacturing/reports/summary")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(summary.body.completedCount).toBeGreaterThanOrEqual(1);
    expect(summary.body.totalCompletedQuantity).toBeGreaterThanOrEqual(10);
    expect(summary.body.activeBomCount).toBeGreaterThanOrEqual(1);

    const byStatus = await request(app.getHttpServer())
      .get("/api/v1/manufacturing/reports/by-status")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(byStatus.body).toHaveLength(4);
    const completed = byStatus.body.find((s: { status: string }) => s.status === "COMPLETED");
    expect(completed.count).toBeGreaterThanOrEqual(1);
  });

  it("exports BOMs and work orders as CSV", async () => {
    const bomsCsv = await request(app.getHttpServer())
      .get("/api/v1/manufacturing/boms/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(bomsCsv.headers["content-type"]).toContain("text/csv");
    expect(bomsCsv.text).toContain("Widget Frame Recipe");

    const woCsv = await request(app.getHttpServer())
      .get("/api/v1/manufacturing/work-orders/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(woCsv.text).toContain("COMPLETED");
  });

  it("exposes the same data over GraphQL as REST", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        query: `query { manufacturingSummary { completedCount totalCompletedQuantity } workOrdersByStatus { status count } billsOfMaterial(page:1,pageSize:10) { total items { name lines { quantity componentProduct { sku } } } } workOrders(page:1,pageSize:10) { total items { workOrderNumber status } } }`,
      })
      .expect(200);
    expect(res.body.data.manufacturingSummary.completedCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.workOrdersByStatus).toHaveLength(4);
    expect(res.body.data.billsOfMaterial.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data.workOrders.total).toBeGreaterThanOrEqual(1);
  });

  it("enforces RBAC: a role without manufacturing permissions is forbidden", async () => {
    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "No Manufacturing", description: "Everything except manufacturing", permissionKeys: ["users:read"] })
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
      .get("/api/v1/manufacturing/boms")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/manufacturing/work-orders")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .send({ bomId, warehouseId, quantity: 1 })
      .expect(403);

    await prisma.user.delete({ where: { id: user.body.id } });
  });

  it("enforces tenant isolation: another company cannot see these BOMs or work orders", async () => {
    const otherEmail = `manufacturing-isolation-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Other Manufacturing Co ${suffix}`,
        email: otherEmail,
        password,
        firstName: "Other",
        lastName: "Owner",
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/manufacturing/work-orders/${workOrderId}`)
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get("/api/v1/manufacturing/boms")
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(200);
    expect(list.body.total).toBe(0);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });
});
