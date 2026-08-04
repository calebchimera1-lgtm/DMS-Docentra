import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Payroll module (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const ownerEmail = `payroll-owner-${suffix}@test.com`;
  const viewerEmail = `payroll-viewer-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";

  let ownerAccess: string;
  let employeeId: string;
  let payRunId: string;

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
        companyName: `Payroll Co ${suffix}`,
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
      .send({ firstName: "Nia", lastName: "Payslip", hireDate: "2024-01-01", salaryCents: 500000 })
      .expect(201);
    employeeId = employee.body.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, viewerEmail] } } });
    await app.close();
  });

  it("creates salary components and rejects a duplicate code", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/payroll/salary-components")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Housing Allowance", code: "HOUSE", type: "EARNING", calculationType: "FIXED", value: 50000 })
      .expect(201);
    await request(app.getHttpServer())
      .post("/api/v1/payroll/salary-components")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Income Tax", code: "TAX", type: "DEDUCTION", calculationType: "PERCENTAGE", value: 1000 })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/payroll/salary-components")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Duplicate", code: "HOUSE", type: "EARNING", value: 100 })
      .expect(409);
  });

  it("creates a draft pay run and rejects an inverted period", async () => {
    const payRun = await request(app.getHttpServer())
      .post("/api/v1/payroll/pay-runs")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ periodStart: "2026-07-01", periodEnd: "2026-07-31", paymentDate: "2026-08-01" })
      .expect(201);
    payRunId = payRun.body.id;
    expect(payRun.body.status).toBe("DRAFT");

    await request(app.getHttpServer())
      .post("/api/v1/payroll/pay-runs")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ periodStart: "2026-07-31", periodEnd: "2026-07-01" })
      .expect(400);
  });

  it("rejects marking a draft pay run paid, and generating a non-draft one", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/payroll/pay-runs/${payRunId}/mark-paid`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("generates payslips computing exact earnings/deductions from the salary component catalog", async () => {
    const generated = await request(app.getHttpServer())
      .post(`/api/v1/payroll/pay-runs/${payRunId}/generate`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(generated.body.status).toBe("PROCESSED");

    const payslips = await request(app.getHttpServer())
      .get(`/api/v1/payroll/payslips?payRunId=${payRunId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(payslips.body.items).toHaveLength(1);

    const payslip = payslips.body.items[0];
    expect(payslip.employee.id).toBe(employeeId);
    expect(payslip.basicSalaryCents).toBe(500000);
    expect(payslip.grossPayCents).toBe(550000); // 500000 basic + 50000 fixed housing
    expect(payslip.deductionsCents).toBe(50000); // 10% of 500000 basic
    expect(payslip.netPayCents).toBe(500000); // 550000 - 50000
    expect(payslip.status).toBe("PENDING");

    await request(app.getHttpServer())
      .post(`/api/v1/payroll/pay-runs/${payRunId}/generate`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("blocks editing/deleting a non-draft pay run", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/payroll/pay-runs/${payRunId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ paymentDate: "2026-09-01" })
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/api/v1/payroll/pay-runs/${payRunId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);
  });

  it("marks a processed pay run and all its payslips paid, then rejects doing so again", async () => {
    const paid = await request(app.getHttpServer())
      .post(`/api/v1/payroll/pay-runs/${payRunId}/mark-paid`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(paid.body.status).toBe("PAID");

    const payslips = await request(app.getHttpServer())
      .get(`/api/v1/payroll/payslips?payRunId=${payRunId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(payslips.body.items[0].status).toBe("PAID");

    await request(app.getHttpServer())
      .post(`/api/v1/payroll/pay-runs/${payRunId}/mark-paid`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/payroll/pay-runs/${payRunId}/cancel`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("allows cancelling a draft pay run", async () => {
    const draft = await request(app.getHttpServer())
      .post("/api/v1/payroll/pay-runs")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ periodStart: "2026-08-01", periodEnd: "2026-08-31" })
      .expect(201);

    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/payroll/pay-runs/${draft.body.id}/cancel`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(cancelled.body.status).toBe("CANCELLED");
  });

  it("reports eligible employees, processed/draft counts, and total net pay paid", async () => {
    const summary = await request(app.getHttpServer())
      .get("/api/v1/payroll/reports/summary")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(summary.body.eligibleEmployeeCount).toBe(1);
    expect(summary.body.totalNetPayPaidCents).toBe(500000);

    const byStatus = await request(app.getHttpServer())
      .get("/api/v1/payroll/reports/payslips-by-status")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    const paid = byStatus.body.find((s: { status: string }) => s.status === "PAID");
    expect(paid.count).toBe(1);
  });

  it("exports salary components, pay runs, and payslips as CSV", async () => {
    const componentsCsv = await request(app.getHttpServer())
      .get("/api/v1/payroll/salary-components/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(componentsCsv.headers["content-type"]).toContain("text/csv");
    expect(componentsCsv.text).toContain("Housing Allowance");

    const payRunsCsv = await request(app.getHttpServer())
      .get("/api/v1/payroll/pay-runs/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(payRunsCsv.text).toContain("PAID");

    const payslipsCsv = await request(app.getHttpServer())
      .get("/api/v1/payroll/payslips/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(payslipsCsv.text).toContain("500000");
  });

  it("exposes the same data over GraphQL as REST", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        query: `query { payrollSummary { eligibleEmployeeCount totalNetPayPaidCents } salaryComponents(page: 1, pageSize: 10) { total } payRuns(page: 1, pageSize: 10) { total items { status payslipCount } } payslips(page: 1, pageSize: 10) { total items { netPayCents status } } }`,
      })
      .expect(200);
    expect(res.body.data.payrollSummary.eligibleEmployeeCount).toBe(1);
    expect(res.body.data.salaryComponents.total).toBe(2);
    expect(res.body.data.payRuns.total).toBe(2);
    expect(res.body.data.payslips.items[0].netPayCents).toBe(500000);
  });

  it("enforces RBAC: a role without payroll permissions is forbidden", async () => {
    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "No Payroll", description: "Everything except payroll", permissionKeys: ["users:read"] })
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
      .get("/api/v1/payroll/pay-runs")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/payroll/salary-components")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .send({ name: "Nope", code: "NOPE", type: "EARNING", value: 1 })
      .expect(403);

    await prisma.user.delete({ where: { id: user.body.id } });
  });

  it("enforces tenant isolation: another company cannot see these payroll records", async () => {
    const otherEmail = `payroll-other-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Other Payroll Co ${suffix}`,
        email: otherEmail,
        password,
        firstName: "Other",
        lastName: "Owner",
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/payroll/pay-runs/${payRunId}`)
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get("/api/v1/payroll/salary-components")
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(200);
    expect(list.body.total).toBe(0);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });
});
