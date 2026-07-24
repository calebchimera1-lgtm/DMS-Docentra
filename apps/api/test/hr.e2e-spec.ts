import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("HR module (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const ownerEmail = `hr-owner-${suffix}@test.com`;
  const viewerEmail = `hr-viewer-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";

  let ownerAccess: string;
  let ownerUserId: string;
  let departmentId: string;
  let managerId: string;
  let reportId: string;
  let leaveRequestId: string;

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
        companyName: `HR Co ${suffix}`,
        email: ownerEmail,
        password,
        firstName: "Owner",
        lastName: "Test",
      })
      .expect(201);
    ownerAccess = reg.body.accessToken;
    ownerUserId = JSON.parse(Buffer.from(ownerAccess.split(".")[1], "base64").toString()).sub;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, viewerEmail] } } });
    await app.close();
  });

  it("creates a department and rejects a duplicate code", async () => {
    const dept = await request(app.getHttpServer())
      .post("/api/v1/hr/departments")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Engineering", code: "ENG" })
      .expect(201);
    departmentId = dept.body.id;

    await request(app.getHttpServer())
      .post("/api/v1/hr/departments")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Duplicate", code: "ENG" })
      .expect(409);
  });

  it("creates employees with auto-generated employee numbers and a manager relationship", async () => {
    const manager = await request(app.getHttpServer())
      .post("/api/v1/hr/employees")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ firstName: "Jamie", lastName: "Rivera", hireDate: "2022-01-10", departmentId })
      .expect(201);
    managerId = manager.body.id;
    expect(manager.body.employeeNumber).toMatch(/^EMP-\d{6}$/);
    expect(manager.body.status).toBe("ACTIVE");

    const report = await request(app.getHttpServer())
      .post("/api/v1/hr/employees")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ firstName: "Sam", lastName: "Okafor", hireDate: "2023-03-01", departmentId, managerId })
      .expect(201);
    reportId = report.body.id;
    expect(report.body.manager.id).toBe(managerId);

    await request(app.getHttpServer())
      .patch(`/api/v1/hr/departments/${departmentId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ managerId })
      .expect(200);
  });

  it("rejects an employee referencing a department/manager outside the company", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/hr/employees")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ firstName: "Ghost", lastName: "Employee", hireDate: "2024-01-01", departmentId: "00000000-0000-0000-0000-000000000000" })
      .expect(400);
  });

  it("submits a leave request and rejects approval by a user with no linked employee profile", async () => {
    const lr = await request(app.getHttpServer())
      .post("/api/v1/hr/leave-requests")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ employeeId: reportId, type: "VACATION", startDate: "2026-08-01", endDate: "2026-08-05", reason: "Trip" })
      .expect(201);
    leaveRequestId = lr.body.id;
    expect(lr.body.status).toBe("PENDING");

    await request(app.getHttpServer())
      .post(`/api/v1/hr/leave-requests/${leaveRequestId}/approve`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);
  });

  it("approves a leave request once the caller has a linked employee profile, and rejects double-approval", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/hr/employees/${managerId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ userId: ownerUserId })
      .expect(200);

    const approved = await request(app.getHttpServer())
      .post(`/api/v1/hr/leave-requests/${leaveRequestId}/approve`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(approved.body.status).toBe("APPROVED");
    expect(approved.body.approver.id).toBe(managerId);

    await request(app.getHttpServer())
      .post(`/api/v1/hr/leave-requests/${leaveRequestId}/approve`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/hr/leave-requests/${leaveRequestId}/cancel`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("rejects a second, separate leave request and allows cancelling a pending one", async () => {
    const lr2 = await request(app.getHttpServer())
      .post("/api/v1/hr/leave-requests")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ employeeId: reportId, type: "SICK", startDate: "2026-09-01", endDate: "2026-09-02" })
      .expect(201);

    const rejected = await request(app.getHttpServer())
      .post(`/api/v1/hr/leave-requests/${lr2.body.id}/reject`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(rejected.body.status).toBe("REJECTED");

    const lr3 = await request(app.getHttpServer())
      .post("/api/v1/hr/leave-requests")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ employeeId: reportId, type: "UNPAID", startDate: "2026-10-01", endDate: "2026-10-02" })
      .expect(201);

    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/hr/leave-requests/${lr3.body.id}/cancel`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(cancelled.body.status).toBe("CANCELLED");
  });

  it("terminates an employee and rejects a second termination", async () => {
    const terminated = await request(app.getHttpServer())
      .post(`/api/v1/hr/employees/${reportId}/terminate`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(terminated.body.status).toBe("TERMINATED");
    expect(terminated.body.terminationDate).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/api/v1/hr/employees/${reportId}/terminate`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("refuses to delete an employee who manages a department or has direct reports", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/hr/employees/${managerId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);
  });

  it("refuses to delete a department that still has employees assigned", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/hr/departments/${departmentId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);
  });

  it("reports headcount summary and by-department breakdown", async () => {
    const summary = await request(app.getHttpServer())
      .get("/api/v1/hr/reports/summary")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(summary.body.totalEmployeeCount).toBe(2);
    expect(summary.body.activeEmployeeCount).toBe(1);
    expect(summary.body.departmentCount).toBe(1);

    const headcount = await request(app.getHttpServer())
      .get("/api/v1/hr/reports/headcount-by-department")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    const engineering = headcount.body.find((d: { departmentName: string }) => d.departmentName === "Engineering");
    expect(engineering.employeeCount).toBe(1);
  });

  it("exports departments, employees, and leave requests as CSV", async () => {
    const deptCsv = await request(app.getHttpServer())
      .get("/api/v1/hr/departments/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(deptCsv.headers["content-type"]).toContain("text/csv");
    expect(deptCsv.text).toContain("Engineering");

    const empCsv = await request(app.getHttpServer())
      .get("/api/v1/hr/employees/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(empCsv.text).toContain("TERMINATED");

    const lrCsv = await request(app.getHttpServer())
      .get("/api/v1/hr/leave-requests/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(lrCsv.text).toContain("APPROVED");
  });

  it("exposes the same data over GraphQL as REST", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        query: `query { hrSummary { totalEmployeeCount activeEmployeeCount } departments(page: 1, pageSize: 10) { total items { code manager { firstName } } } employees(page: 1, pageSize: 10) { total } leaveRequests(page: 1, pageSize: 10) { total } }`,
      })
      .expect(200);
    expect(res.body.data.hrSummary.totalEmployeeCount).toBe(2);
    expect(res.body.data.departments.total).toBe(1);
    expect(res.body.data.departments.items[0].manager.firstName).toBe("Jamie");
    expect(res.body.data.employees.total).toBe(2);
    expect(res.body.data.leaveRequests.total).toBe(3);
  });

  it("enforces RBAC: a role without HR permissions is forbidden", async () => {
    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "No HR", description: "Everything except HR", permissionKeys: ["users:read"] })
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
      .get("/api/v1/hr/departments")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/hr/employees")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .send({ firstName: "Nope", lastName: "Nope", hireDate: "2024-01-01" })
      .expect(403);

    await prisma.user.delete({ where: { id: user.body.id } });
  });

  it("enforces tenant isolation: another company cannot see these HR records", async () => {
    const otherEmail = `hr-other-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Other HR Co ${suffix}`,
        email: otherEmail,
        password,
        firstName: "Other",
        lastName: "Owner",
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/hr/departments/${departmentId}`)
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get("/api/v1/hr/employees")
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(200);
    expect(list.body.total).toBe(0);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });
});
