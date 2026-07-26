import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Attendance module (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const ownerEmail = `attendance-owner-${suffix}@test.com`;
  const viewerEmail = `attendance-viewer-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";

  let ownerAccess: string;
  let employeeId: string;
  let secondEmployeeId: string;
  let recordId: string;

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
        companyName: `Attendance Co ${suffix}`,
        email: ownerEmail,
        password,
        firstName: "Owner",
        lastName: "Test",
      })
      .expect(201);
    ownerAccess = reg.body.accessToken;

    const employee = await request(app.getHttpServer())
      .post("/api/v1/hr/employees")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ firstName: "Jordan", lastName: "Worker", hireDate: "2025-01-01" })
      .expect(201);
    employeeId = employee.body.id;

    const employee2 = await request(app.getHttpServer())
      .post("/api/v1/hr/employees")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ firstName: "Casey", lastName: "Colleague", hireDate: "2025-01-01" })
      .expect(201);
    secondEmployeeId = employee2.body.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, viewerEmail] } } });
    await app.close();
  });

  it("clocks an employee in, stamping clockInAt and a PRESENT/LATE status", async () => {
    const record = await request(app.getHttpServer())
      .post("/api/v1/attendance/clock-in")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ employeeId })
      .expect(201);
    recordId = record.body.id;
    expect(record.body.clockInAt).toBeTruthy();
    expect(record.body.clockOutAt).toBeNull();
    expect(["PRESENT", "LATE"]).toContain(record.body.status);
    expect(record.body.employee.id).toBe(employeeId);
  });

  it("rejects clocking in the same employee twice in one day", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/attendance/clock-in")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ employeeId })
      .expect(400);
  });

  it("rejects clocking out a record that hasn't clocked in via a bogus id", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/attendance/00000000-0000-0000-0000-000000000000/clock-out")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(404);
  });

  it("clocks out, computing worked minutes", async () => {
    const record = await request(app.getHttpServer())
      .post(`/api/v1/attendance/${recordId}/clock-out`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(record.body.clockOutAt).toBeTruthy();
    expect(typeof record.body.workedMinutes).toBe("number");
    expect(record.body.workedMinutes).toBeGreaterThanOrEqual(0);
  });

  it("rejects clocking out twice", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/attendance/${recordId}/clock-out`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("rejects marking a day PRESENT or LATE manually", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/attendance/mark")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ employeeId: secondEmployeeId, date: "2026-01-05", status: "PRESENT" })
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/v1/attendance/mark")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ employeeId: secondEmployeeId, date: "2026-01-05", status: "LATE" })
      .expect(400);
  });

  it("marks a day ABSENT, then re-marking the same day upserts to ON_LEAVE", async () => {
    const marked = await request(app.getHttpServer())
      .post("/api/v1/attendance/mark")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ employeeId: secondEmployeeId, date: "2026-01-05", status: "ABSENT", note: "No call no show" })
      .expect(201);
    expect(marked.body.status).toBe("ABSENT");
    expect(marked.body.note).toBe("No call no show");
    expect(marked.body.clockInAt).toBeNull();

    const remarked = await request(app.getHttpServer())
      .post("/api/v1/attendance/mark")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ employeeId: secondEmployeeId, date: "2026-01-05", status: "ON_LEAVE" })
      .expect(201);
    expect(remarked.body.status).toBe("ON_LEAVE");
    expect(remarked.body.id).toBe(marked.body.id);
  });

  it("filters by employee, status, and date range", async () => {
    const byEmployee = await request(app.getHttpServer())
      .get(`/api/v1/attendance?employeeId=${secondEmployeeId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(byEmployee.body.total).toBe(1);

    const byRange = await request(app.getHttpServer())
      .get("/api/v1/attendance?dateFrom=2026-01-01&dateTo=2026-01-31")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(byRange.body.total).toBeGreaterThanOrEqual(1);

    const byStatus = await request(app.getHttpServer())
      .get("/api/v1/attendance?status=ON_LEAVE")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(byStatus.body.items.every((r: { status: string }) => r.status === "ON_LEAVE")).toBe(true);
  });

  it("updates a record's note", async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/attendance/${recordId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ note: "Left early for an appointment" })
      .expect(200);
    expect(updated.body.note).toBe("Left early for an appointment");
  });

  it("reports today's summary and by-status breakdown", async () => {
    const summary = await request(app.getHttpServer())
      .get("/api/v1/attendance/reports/summary")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(summary.body.presentCount + summary.body.lateCount).toBeGreaterThanOrEqual(1);
    expect(summary.body.activeEmployeeCount).toBeGreaterThanOrEqual(2);

    const byStatus = await request(app.getHttpServer())
      .get("/api/v1/attendance/reports/by-status")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(byStatus.body).toHaveLength(5);
  });

  it("exports attendance records as CSV", async () => {
    const csv = await request(app.getHttpServer())
      .get("/api/v1/attendance/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.text).toContain("Jordan");
  });

  it("exposes the same data over GraphQL as REST", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        query: `query { attendanceSummary { activeEmployeeCount } attendanceByStatus { status count } attendanceRecords(page:1,pageSize:10) { total items { status employee { employeeNumber } } } }`,
      })
      .expect(200);
    expect(res.body.data.attendanceSummary.activeEmployeeCount).toBeGreaterThanOrEqual(2);
    expect(res.body.data.attendanceByStatus).toHaveLength(5);
    expect(res.body.data.attendanceRecords.total).toBeGreaterThanOrEqual(2);
  });

  it("deletes an attendance record", async () => {
    const marked = await request(app.getHttpServer())
      .post("/api/v1/attendance/mark")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ employeeId: secondEmployeeId, date: "2026-02-01", status: "ABSENT" })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/attendance/${marked.body.id}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/attendance/${marked.body.id}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(404);
  });

  it("enforces RBAC: a role without attendance permissions is forbidden", async () => {
    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "No Attendance", description: "Everything except attendance", permissionKeys: ["users:read"] })
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
      .get("/api/v1/attendance")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/attendance/clock-in")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .send({ employeeId })
      .expect(403);

    await prisma.user.delete({ where: { id: user.body.id } });
  });

  it("enforces tenant isolation: another company cannot see these attendance records", async () => {
    const otherEmail = `attendance-isolation-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Other Attendance Co ${suffix}`,
        email: otherEmail,
        password,
        firstName: "Other",
        lastName: "Owner",
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/attendance/${recordId}`)
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get("/api/v1/attendance")
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(200);
    expect(list.body.total).toBe(0);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });
});
