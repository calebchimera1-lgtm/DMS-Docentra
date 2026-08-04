import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Fleet module (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const ownerEmail = `fleet-owner-${suffix}@test.com`;
  const viewerEmail = `fleet-viewer-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";

  let ownerAccess: string;
  let driverId: string;
  let vehicleId: string;
  let tripId: string;
  let maintenanceId: string;

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
        companyName: `Fleet Co ${suffix}`,
        email: ownerEmail,
        password,
        firstName: "Owner",
        lastName: "Test",
      })
      .expect(201);
    ownerAccess = reg.body.accessToken;

    const driver = await request(app.getHttpServer())
      .post("/api/v1/hr/employees")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ firstName: "Dana", lastName: "Driver", hireDate: "2025-01-01" })
      .expect(201);
    driverId = driver.body.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, viewerEmail] } } });
    await app.close();
  });

  it("creates a vehicle with an assigned driver and a starting odometer reading", async () => {
    const vehicle = await request(app.getHttpServer())
      .post("/api/v1/fleet/vehicles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        registrationNumber: `KAA-${suffix.toString().slice(-6)}`,
        make: "Toyota",
        model: "Hiace",
        year: 2021,
        odometerReading: 50_000,
        fuelType: "Diesel",
        assignedDriverId: driverId,
      })
      .expect(201);
    vehicleId = vehicle.body.id;
    expect(vehicle.body.status).toBe("ACTIVE");
    expect(vehicle.body.odometerReading).toBe(50_000);
    expect(vehicle.body.assignedDriver.id).toBe(driverId);
  });

  it("rejects assigning a driver that belongs to another company", async () => {
    const otherEmail = `fleet-otherdriver-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Foreign Fleet Co ${suffix}`,
        email: otherEmail,
        password,
        firstName: "Foreign",
        lastName: "Owner",
      })
      .expect(201);

    const foreignDriver = await request(app.getHttpServer())
      .post("/api/v1/hr/employees")
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .send({ firstName: "Fern", lastName: "Foreign", hireDate: "2025-01-01" })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/fleet/vehicles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        registrationNumber: `KBB-${suffix.toString().slice(-6)}`,
        make: "Isuzu",
        model: "NPR",
        assignedDriverId: foreignDriver.body.id,
      })
      .expect(400);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });

  it("starts a trip, snapshotting the vehicle's current odometer as startOdometer", async () => {
    const trip = await request(app.getHttpServer())
      .post("/api/v1/fleet/trips")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ vehicleId, purpose: "Delivery run" })
      .expect(201);
    tripId = trip.body.id;
    expect(trip.body.status).toBe("IN_PROGRESS");
    expect(trip.body.startOdometer).toBe(50_000);
    expect(trip.body.endOdometer).toBeNull();
    // Defaults to the vehicle's assigned driver when none is supplied.
    expect(trip.body.driver.id).toBe(driverId);
  });

  it("rejects completing a trip with an end odometer below the start reading", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/fleet/trips/${tripId}/complete`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ endOdometer: 49_000 })
      .expect(400);
  });

  it("refuses to delete a trip while it is still in progress", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/fleet/trips/${tripId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);
  });

  it("completes the trip, computing distance and updating the vehicle's odometer", async () => {
    const completed = await request(app.getHttpServer())
      .post(`/api/v1/fleet/trips/${tripId}/complete`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ endOdometer: 50_120 })
      .expect(201);
    expect(completed.body.status).toBe("COMPLETED");
    expect(completed.body.endOdometer).toBe(50_120);
    expect(completed.body.distance).toBe(120);
    expect(completed.body.endedAt).toBeTruthy();

    const vehicle = await request(app.getHttpServer())
      .get(`/api/v1/fleet/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(vehicle.body.odometerReading).toBe(50_120);
  });

  it("rejects completing or cancelling a trip that is no longer in progress", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/fleet/trips/${tripId}/complete`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ endOdometer: 50_200 })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/fleet/trips/${tripId}/cancel`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("schedules a maintenance job and flips the vehicle to IN_MAINTENANCE when started", async () => {
    const record = await request(app.getHttpServer())
      .post("/api/v1/fleet/maintenance")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ vehicleId, type: "SERVICE", scheduledDate: "2026-03-01", description: "30,000 km service" })
      .expect(201);
    maintenanceId = record.body.id;
    expect(record.body.status).toBe("SCHEDULED");

    const started = await request(app.getHttpServer())
      .post(`/api/v1/fleet/maintenance/${maintenanceId}/start`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(started.body.status).toBe("IN_PROGRESS");

    const vehicle = await request(app.getHttpServer())
      .get(`/api/v1/fleet/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(vehicle.body.status).toBe("IN_MAINTENANCE");
  });

  it("refuses to start a new trip on a vehicle that is in maintenance", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/fleet/trips")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ vehicleId, purpose: "Should not start" })
      .expect(400);
  });

  it("refuses to retire a vehicle while it is in maintenance", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/fleet/vehicles/${vehicleId}/retire`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("completes the maintenance job, recording cost and returning the vehicle to ACTIVE", async () => {
    const completed = await request(app.getHttpServer())
      .post(`/api/v1/fleet/maintenance/${maintenanceId}/complete`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ costCents: 8_500 })
      .expect(201);
    expect(completed.body.status).toBe("COMPLETED");
    expect(completed.body.costCents).toBe(8_500);
    expect(completed.body.completedDate).toBeTruthy();

    const vehicle = await request(app.getHttpServer())
      .get(`/api/v1/fleet/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(vehicle.body.status).toBe("ACTIVE");
  });

  it("reverts the vehicle to ACTIVE when an in-progress maintenance job is cancelled", async () => {
    const record = await request(app.getHttpServer())
      .post("/api/v1/fleet/maintenance")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ vehicleId, type: "REPAIR", scheduledDate: "2026-04-01" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/fleet/maintenance/${record.body.id}/start`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);

    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/fleet/maintenance/${record.body.id}/cancel`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(cancelled.body.status).toBe("CANCELLED");

    const vehicle = await request(app.getHttpServer())
      .get(`/api/v1/fleet/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(vehicle.body.status).toBe("ACTIVE");
  });

  it("retires a vehicle, reactivates it, and only allows deleting it once retired", async () => {
    const vehicle = await request(app.getHttpServer())
      .post("/api/v1/fleet/vehicles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ registrationNumber: `KCC-${suffix.toString().slice(-6)}`, make: "Nissan", model: "Caravan" })
      .expect(201);

    // An ACTIVE vehicle cannot be deleted.
    await request(app.getHttpServer())
      .delete(`/api/v1/fleet/vehicles/${vehicle.body.id}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);

    const retired = await request(app.getHttpServer())
      .post(`/api/v1/fleet/vehicles/${vehicle.body.id}/retire`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(retired.body.status).toBe("RETIRED");

    // Retiring twice is rejected.
    await request(app.getHttpServer())
      .post(`/api/v1/fleet/vehicles/${vehicle.body.id}/retire`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);

    const reactivated = await request(app.getHttpServer())
      .post(`/api/v1/fleet/vehicles/${vehicle.body.id}/reactivate`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(reactivated.body.status).toBe("ACTIVE");

    // Reactivating a non-retired vehicle is rejected.
    await request(app.getHttpServer())
      .post(`/api/v1/fleet/vehicles/${vehicle.body.id}/reactivate`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/fleet/vehicles/${vehicle.body.id}/retire`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/fleet/vehicles/${vehicle.body.id}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/fleet/vehicles/${vehicle.body.id}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(404);
  });

  it("refuses maintenance on a retired vehicle", async () => {
    const vehicle = await request(app.getHttpServer())
      .post("/api/v1/fleet/vehicles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ registrationNumber: `KDD-${suffix.toString().slice(-6)}`, make: "Ford", model: "Transit" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/fleet/vehicles/${vehicle.body.id}/retire`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);

    const record = await request(app.getHttpServer())
      .post("/api/v1/fleet/maintenance")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ vehicleId: vehicle.body.id, scheduledDate: "2026-05-01" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/fleet/maintenance/${record.body.id}/start`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("updates a vehicle and filters the list by search and status", async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/fleet/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ note: "Fitted with a new tracker" })
      .expect(200);
    expect(updated.body.note).toBe("Fitted with a new tracker");

    const bySearch = await request(app.getHttpServer())
      .get("/api/v1/fleet/vehicles?search=Hiace")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(bySearch.body.total).toBe(1);

    const byStatus = await request(app.getHttpServer())
      .get("/api/v1/fleet/vehicles?status=RETIRED")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(byStatus.body.items.every((v: { status: string }) => v.status === "RETIRED")).toBe(true);
  });

  it("reports the fleet summary and vehicles-by-status breakdown", async () => {
    const summary = await request(app.getHttpServer())
      .get("/api/v1/fleet/reports/summary")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(summary.body.activeCount).toBeGreaterThanOrEqual(1);
    expect(summary.body.inMaintenanceCount).toBe(0);
    expect(summary.body.tripsInProgressCount).toBe(0);
    expect(summary.body.totalDistanceAllTime).toBe(120);

    const byStatus = await request(app.getHttpServer())
      .get("/api/v1/fleet/reports/by-status")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(byStatus.body).toHaveLength(3);
  });

  it("exports vehicles, trips, and maintenance records as CSV", async () => {
    const vehicles = await request(app.getHttpServer())
      .get("/api/v1/fleet/vehicles/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(vehicles.headers["content-type"]).toContain("text/csv");
    expect(vehicles.text).toContain("Hiace");

    const trips = await request(app.getHttpServer())
      .get("/api/v1/fleet/trips/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(trips.text).toContain("Delivery run");

    const maintenance = await request(app.getHttpServer())
      .get("/api/v1/fleet/maintenance/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(maintenance.text).toContain("SERVICE");
  });

  it("exposes the same data over GraphQL as REST", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        query: `query {
          fleetSummary { activeCount inMaintenanceCount retiredCount tripsInProgressCount totalDistanceAllTime }
          vehiclesByStatus { status count }
          vehicles(page:1,pageSize:10) { total items { registrationNumber status odometerReading } }
          trips(page:1,pageSize:10) { total items { status startOdometer distance } }
          maintenanceRecords(page:1,pageSize:10) { total items { type status costCents } }
        }`,
      })
      .expect(200);

    expect(res.body.data.fleetSummary.totalDistanceAllTime).toBe(120);
    expect(res.body.data.fleetSummary.inMaintenanceCount).toBe(0);
    expect(res.body.data.vehiclesByStatus).toHaveLength(3);
    expect(res.body.data.vehicles.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data.trips.total).toBe(1);
    expect(res.body.data.trips.items[0].distance).toBe(120);
    expect(res.body.data.maintenanceRecords.total).toBeGreaterThanOrEqual(2);
  });

  it("enforces RBAC: a role without fleet permissions is forbidden", async () => {
    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "No Fleet", description: "Everything except fleet", permissionKeys: ["users:read"] })
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
      .get("/api/v1/fleet/vehicles")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/fleet/trips")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .send({ vehicleId })
      .expect(403);

    await request(app.getHttpServer())
      .get("/api/v1/fleet/reports/summary")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await prisma.user.delete({ where: { id: user.body.id } });
  });

  it("enforces tenant isolation: another company cannot see these fleet records", async () => {
    const otherEmail = `fleet-isolation-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Other Fleet Co ${suffix}`,
        email: otherEmail,
        password,
        firstName: "Other",
        lastName: "Owner",
      })
      .expect(201);
    const otherAccess = otherReg.body.accessToken;

    await request(app.getHttpServer())
      .get(`/api/v1/fleet/vehicles/${vehicleId}`)
      .set("Authorization", `Bearer ${otherAccess}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/fleet/trips/${tripId}`)
      .set("Authorization", `Bearer ${otherAccess}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/fleet/maintenance/${maintenanceId}`)
      .set("Authorization", `Bearer ${otherAccess}`)
      .expect(404);

    // A foreign company cannot start a trip on this company's vehicle either.
    await request(app.getHttpServer())
      .post("/api/v1/fleet/trips")
      .set("Authorization", `Bearer ${otherAccess}`)
      .send({ vehicleId })
      .expect(400);

    const list = await request(app.getHttpServer())
      .get("/api/v1/fleet/vehicles")
      .set("Authorization", `Bearer ${otherAccess}`)
      .expect(200);
    expect(list.body.total).toBe(0);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });
});
