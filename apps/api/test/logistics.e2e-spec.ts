import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Logistics module (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const ownerEmail = `logistics-owner-${suffix}@test.com`;
  const viewerEmail = `logistics-viewer-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";

  let ownerAccess: string;
  let warehouseId: string;
  let productId: string;
  let vehicleId: string;
  let driverId: string;
  let shipmentId: string;

  /** Current on-hand quantity of the test product at the test warehouse. */
  async function stockOnHand(): Promise<number> {
    const item = await prisma.stockItem.findFirst({ where: { productId, warehouseId } });
    return item?.quantityOnHand ?? 0;
  }

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
        companyName: `Logistics Co ${suffix}`,
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
      .send({ name: "Depot", code: `DEP-${suffix.toString().slice(-6)}` })
      .expect(201);
    warehouseId = warehouse.body.id;

    const product = await request(app.getHttpServer())
      .post("/api/v1/sales/products")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ sku: `SKU-${suffix.toString().slice(-6)}`, name: "Crate", unitPriceCents: 5_000 })
      .expect(201);
    productId = product.body.id;

    const driver = await request(app.getHttpServer())
      .post("/api/v1/hr/employees")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ firstName: "Dana", lastName: "Driver", hireDate: "2025-01-01" })
      .expect(201);
    driverId = driver.body.id;

    const vehicle = await request(app.getHttpServer())
      .post("/api/v1/fleet/vehicles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        registrationNumber: `LOG-${suffix.toString().slice(-6)}`,
        make: "Isuzu",
        model: "NQR",
        odometerReading: 20_000,
        assignedDriverId: driverId,
      })
      .expect(201);
    vehicleId = vehicle.body.id;

    // Stock the depot so dispatch has something to move.
    await request(app.getHttpServer())
      .post("/api/v1/inventory/movements")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ productId, warehouseId, type: "RECEIPT", quantity: 100 })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, viewerEmail] } } });
    await app.close();
  });

  it("creates a draft shipment with an opening tracking event", async () => {
    const shipment = await request(app.getHttpServer())
      .post("/api/v1/logistics/shipments")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        warehouseId,
        vehicleId,
        destinationAddress: "12 Riverside Drive",
        contactName: "Ada Recipient",
        items: [{ productId, description: "Crate of widgets", quantity: 10, unitPriceCents: 5_000 }],
      })
      .expect(201);
    shipmentId = shipment.body.id;

    expect(shipment.body.shipmentNumber).toMatch(/^SHP-\d+$/);
    expect(shipment.body.status).toBe("DRAFT");
    expect(shipment.body.dispatchedAt).toBeNull();
    expect(shipment.body.events).toHaveLength(1);
    expect(shipment.body.events[0].status).toBe("DRAFT");
  });

  it("rejects a warehouse, vehicle, or driver from another company", async () => {
    const otherEmail = `logistics-foreign-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Foreign Logistics Co ${suffix}`,
        email: otherEmail,
        password,
        firstName: "Foreign",
        lastName: "Owner",
      })
      .expect(201);

    const foreignWarehouse = await request(app.getHttpServer())
      .post("/api/v1/inventory/warehouses")
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .send({ name: "Foreign Depot", code: `FDP-${suffix.toString().slice(-6)}` })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/logistics/shipments")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        warehouseId: foreignWarehouse.body.id,
        destinationAddress: "Nowhere",
        items: [{ description: "x", quantity: 1, unitPriceCents: 1 }],
      })
      .expect(400);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });

  it("dispatches the shipment, deducting stock and opening a Fleet trip", async () => {
    const before = await stockOnHand();
    expect(before).toBe(100);

    const dispatched = await request(app.getHttpServer())
      .post(`/api/v1/logistics/shipments/${shipmentId}/dispatch`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({})
      .expect(201);

    expect(dispatched.body.status).toBe("DISPATCHED");
    expect(dispatched.body.dispatchedAt).toBeTruthy();
    // Driver defaults to the vehicle's assigned driver.
    expect(dispatched.body.driver.id).toBe(driverId);
    // A Fleet trip is opened, snapshotting the vehicle's odometer.
    expect(dispatched.body.trip).toBeTruthy();
    expect(dispatched.body.trip.status).toBe("IN_PROGRESS");
    expect(dispatched.body.trip.startOdometer).toBe(20_000);
    expect(dispatched.body.events).toHaveLength(2);

    expect(await stockOnHand()).toBe(90);
  });

  it("records the outbound stock movement against the shipment number", async () => {
    const movements = await request(app.getHttpServer())
      .get(`/api/v1/inventory/movements?page=1&pageSize=50&type=SALE`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);

    const shipment = await request(app.getHttpServer())
      .get(`/api/v1/logistics/shipments/${shipmentId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);

    const match = movements.body.items.find(
      (m: { reference: string | null }) => m.reference === shipment.body.shipmentNumber,
    );
    expect(match).toBeTruthy();
    expect(match.quantity).toBe(-10);
  });

  it("rejects editing, cancelling, or re-dispatching a shipment that has left", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/logistics/shipments/${shipmentId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ note: "too late" })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/logistics/shipments/${shipmentId}/cancel`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/logistics/shipments/${shipmentId}/dispatch`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({})
      .expect(400);
  });

  it("tracks the shipment in transit and then delivered, appending an event each time", async () => {
    const inTransit = await request(app.getHttpServer())
      .post(`/api/v1/logistics/shipments/${shipmentId}/in-transit`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ location: "Mombasa Road checkpoint" })
      .expect(201);
    expect(inTransit.body.status).toBe("IN_TRANSIT");
    expect(inTransit.body.events).toHaveLength(3);
    expect(inTransit.body.events[2].location).toBe("Mombasa Road checkpoint");

    const delivered = await request(app.getHttpServer())
      .post(`/api/v1/logistics/shipments/${shipmentId}/deliver`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ location: "12 Riverside Drive", note: "Signed by Ada" })
      .expect(201);
    expect(delivered.body.status).toBe("DELIVERED");
    expect(delivered.body.deliveredAt).toBeTruthy();
    expect(delivered.body.events).toHaveLength(4);
    expect(delivered.body.events.map((e: { status: string }) => e.status)).toEqual([
      "DRAFT",
      "DISPATCHED",
      "IN_TRANSIT",
      "DELIVERED",
    ]);

    // Delivering does not move stock again — it left at dispatch.
    expect(await stockOnHand()).toBe(90);
  });

  it("returns the stock when a dispatched delivery fails", async () => {
    const shipment = await request(app.getHttpServer())
      .post("/api/v1/logistics/shipments")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        warehouseId,
        destinationAddress: "Unreachable Farm",
        items: [{ productId, description: "Crate", quantity: 15, unitPriceCents: 5_000 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/logistics/shipments/${shipment.body.id}/dispatch`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({})
      .expect(201);
    expect(await stockOnHand()).toBe(75);

    const failed = await request(app.getHttpServer())
      .post(`/api/v1/logistics/shipments/${shipment.body.id}/fail`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ failureReason: "Recipient unreachable", location: "Gate 4" })
      .expect(201);
    expect(failed.body.status).toBe("FAILED");
    expect(failed.body.failureReason).toBe("Recipient unreachable");

    expect(await stockOnHand()).toBe(90);
  });

  it("refuses to dispatch more than is on hand, leaving stock and status untouched", async () => {
    const shipment = await request(app.getHttpServer())
      .post("/api/v1/logistics/shipments")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        warehouseId,
        destinationAddress: "Greedy Depot",
        items: [{ productId, description: "Crate", quantity: 9_999, unitPriceCents: 1 }],
      })
      .expect(201);

    const before = await stockOnHand();
    await request(app.getHttpServer())
      .post(`/api/v1/logistics/shipments/${shipment.body.id}/dispatch`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({})
      .expect(400);

    // The whole dispatch is one transaction, so nothing moved.
    expect(await stockOnHand()).toBe(before);
    const after = await request(app.getHttpServer())
      .get(`/api/v1/logistics/shipments/${shipment.body.id}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(after.body.status).toBe("DRAFT");
    expect(after.body.trip).toBeNull();
  });

  it("refuses to dispatch on a vehicle that is not active", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/fleet/vehicles/${vehicleId}/retire`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);

    const shipment = await request(app.getHttpServer())
      .post("/api/v1/logistics/shipments")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        warehouseId,
        vehicleId,
        destinationAddress: "Retired Vehicle Depot",
        items: [{ productId, description: "Crate", quantity: 1, unitPriceCents: 1 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/logistics/shipments/${shipment.body.id}/dispatch`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/fleet/vehicles/${vehicleId}/reactivate`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
  });

  it("cancels a draft shipment and only then allows deleting it", async () => {
    const shipment = await request(app.getHttpServer())
      .post("/api/v1/logistics/shipments")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        warehouseId,
        destinationAddress: "Cancelled Depot",
        items: [{ description: "Nothing", quantity: 1, unitPriceCents: 0 }],
      })
      .expect(201);

    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/logistics/shipments/${shipment.body.id}/cancel`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(cancelled.body.status).toBe("CANCELLED");
    expect(cancelled.body.events).toHaveLength(2);

    await request(app.getHttpServer())
      .delete(`/api/v1/logistics/shipments/${shipment.body.id}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/logistics/shipments/${shipment.body.id}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(404);
  });

  it("refuses to delete a shipment that has already been delivered", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/logistics/shipments/${shipmentId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);
  });

  it("edits a draft shipment and filters the list by search and status", async () => {
    const shipment = await request(app.getHttpServer())
      .post("/api/v1/logistics/shipments")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        warehouseId,
        destinationAddress: "Editable Depot",
        items: [{ description: "Thing", quantity: 1, unitPriceCents: 100 }],
      })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/logistics/shipments/${shipment.body.id}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ destinationAddress: "Edited Depot", note: "Address corrected" })
      .expect(200);
    expect(updated.body.destinationAddress).toBe("Edited Depot");
    expect(updated.body.note).toBe("Address corrected");

    const bySearch = await request(app.getHttpServer())
      .get("/api/v1/logistics/shipments?search=Edited")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(bySearch.body.total).toBe(1);

    const byStatus = await request(app.getHttpServer())
      .get("/api/v1/logistics/shipments?status=DELIVERED")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(byStatus.body.items.every((s: { status: string }) => s.status === "DELIVERED")).toBe(true);
  });

  it("reports the logistics summary and shipments-by-status breakdown", async () => {
    const summary = await request(app.getHttpServer())
      .get("/api/v1/logistics/reports/summary")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(summary.body.deliveredCount).toBe(1);
    expect(summary.body.failedCount).toBe(1);
    // One delivered, one failed — draft and cancelled are excluded from the rate.
    expect(summary.body.deliveredRatePercent).toBe(50);

    const byStatus = await request(app.getHttpServer())
      .get("/api/v1/logistics/reports/by-status")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(byStatus.body).toHaveLength(6);
  });

  it("exports shipments as CSV", async () => {
    const csv = await request(app.getHttpServer())
      .get("/api/v1/logistics/shipments/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.text).toContain("12 Riverside Drive");
    expect(csv.text).toContain("DELIVERED");
  });

  it("exposes the same data over GraphQL as REST", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        query: `query {
          logisticsSummary { deliveredCount failedCount deliveredRatePercent totalCount }
          shipmentsByStatus { status count }
          shipments(page:1,pageSize:20) { total items { shipmentNumber status itemCount } }
          shipment(id:"${shipmentId}") { shipmentNumber status itemCount events { status location } }
        }`,
      })
      .expect(200);

    expect(res.body.data.logisticsSummary.deliveredCount).toBe(1);
    expect(res.body.data.logisticsSummary.deliveredRatePercent).toBe(50);
    expect(res.body.data.shipmentsByStatus).toHaveLength(6);
    expect(res.body.data.shipments.total).toBeGreaterThanOrEqual(4);
    expect(res.body.data.shipment.status).toBe("DELIVERED");
    expect(res.body.data.shipment.itemCount).toBe(1);
    expect(res.body.data.shipment.events).toHaveLength(4);
  });

  it("enforces RBAC: a role without logistics permissions is forbidden", async () => {
    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "No Logistics", description: "Everything except logistics", permissionKeys: ["users:read"] })
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
      .get("/api/v1/logistics/shipments")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/logistics/shipments/${shipmentId}/dispatch`)
      .set("Authorization", `Bearer ${viewerAccess}`)
      .send({})
      .expect(403);

    await request(app.getHttpServer())
      .get("/api/v1/logistics/reports/summary")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await prisma.user.delete({ where: { id: user.body.id } });
  });

  it("enforces tenant isolation: another company cannot see these shipments", async () => {
    const otherEmail = `logistics-isolation-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Other Logistics Co ${suffix}`,
        email: otherEmail,
        password,
        firstName: "Other",
        lastName: "Owner",
      })
      .expect(201);
    const otherAccess = otherReg.body.accessToken;

    await request(app.getHttpServer())
      .get(`/api/v1/logistics/shipments/${shipmentId}`)
      .set("Authorization", `Bearer ${otherAccess}`)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get("/api/v1/logistics/shipments")
      .set("Authorization", `Bearer ${otherAccess}`)
      .expect(200);
    expect(list.body.total).toBe(0);

    const summary = await request(app.getHttpServer())
      .get("/api/v1/logistics/reports/summary")
      .set("Authorization", `Bearer ${otherAccess}`)
      .expect(200);
    expect(summary.body.totalCount).toBe(0);
    expect(summary.body.deliveredRatePercent).toBe(0);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });
});
