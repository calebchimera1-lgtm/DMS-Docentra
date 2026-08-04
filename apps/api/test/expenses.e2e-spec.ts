import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Expenses module (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const ownerEmail = `expenses-owner-${suffix}@test.com`;
  const viewerEmail = `expenses-viewer-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";

  let ownerAccess: string;
  let ownerUserId: string;
  let employeeId: string;
  let debitAccountId: string;
  let creditAccountId: string;
  let categoryId: string;
  let unmappedCategoryId: string;
  let claimId: string;

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
        companyName: `Expenses Co ${suffix}`,
        email: ownerEmail,
        password,
        firstName: "Owner",
        lastName: "Test",
      })
      .expect(201);
    ownerAccess = reg.body.accessToken;
    ownerUserId = JSON.parse(Buffer.from(ownerAccess.split(".")[1], "base64").toString()).sub;

    const employee = await request(app.getHttpServer())
      .post("/api/v1/hr/employees")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ firstName: "Nia", lastName: "Claimant", hireDate: "2024-01-01" })
      .expect(201);
    employeeId = employee.body.id;

    // approve()/reject() resolve the caller's own Employee profile as the
    // approver, the same convention HR's leave-request approve() uses —
    // link the registering owner's User to an Employee so those calls work.
    const approverEmployee = await request(app.getHttpServer())
      .post("/api/v1/hr/employees")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ firstName: "Owner", lastName: "Approver", hireDate: "2024-01-01" })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/hr/employees/${approverEmployee.body.id}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ userId: ownerUserId })
      .expect(200);

    const debitAccount = await request(app.getHttpServer())
      .post("/api/v1/accounting/ledger-accounts")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ code: "6100", name: "Travel Expense", type: "EXPENSE" })
      .expect(201);
    debitAccountId = debitAccount.body.id;

    const creditAccount = await request(app.getHttpServer())
      .post("/api/v1/accounting/ledger-accounts")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ code: "2100", name: "Employee Reimbursements Payable", type: "LIABILITY" })
      .expect(201);
    creditAccountId = creditAccount.body.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, viewerEmail] } } });
    await app.close();
  });

  it("creates expense categories and rejects a duplicate code", async () => {
    const category = await request(app.getHttpServer())
      .post("/api/v1/expenses/categories")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Travel", code: "TRAVEL", ledgerAccountId: debitAccountId })
      .expect(201);
    categoryId = category.body.id;

    const unmapped = await request(app.getHttpServer())
      .post("/api/v1/expenses/categories")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Meals", code: "MEALS" })
      .expect(201);
    unmappedCategoryId = unmapped.body.id;

    await request(app.getHttpServer())
      .post("/api/v1/expenses/categories")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Duplicate", code: "TRAVEL" })
      .expect(409);
  });

  it("creates a draft expense claim, computing the total from its line items", async () => {
    const claim = await request(app.getHttpServer())
      .post("/api/v1/expenses/claims")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        employeeId,
        expenseDate: "2026-07-20",
        items: [
          { categoryId, description: "Flight to client site", amountCents: 45000 },
          { categoryId, description: "Taxi", amountCents: 2500 },
        ],
      })
      .expect(201);
    claimId = claim.body.id;
    expect(claim.body.status).toBe("DRAFT");
    expect(claim.body.totalCents).toBe(47500);
    expect(claim.body.claimNumber).toMatch(/^EXP-/);
  });

  it("rejects a claim line referencing a category from another company", async () => {
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Expenses Other ${suffix}`,
        email: `expenses-other-${suffix}@test.com`,
        password,
        firstName: "Other",
        lastName: "Owner",
      })
      .expect(201);
    const otherEmployee = await request(app.getHttpServer())
      .post("/api/v1/hr/employees")
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .send({ firstName: "Foreign", lastName: "Emp", hireDate: "2024-01-01" })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/expenses/claims")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        employeeId,
        expenseDate: "2026-07-20",
        items: [{ categoryId: otherEmployee.body.id, description: "Bad", amountCents: 100 }],
      })
      .expect(400);

    await prisma.user.deleteMany({ where: { email: `expenses-other-${suffix}@test.com` } });
  });

  it("blocks editing/deleting a non-draft claim, and submitting it twice", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/expenses/claims/${claimId}/submit`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/expenses/claims/${claimId}/submit`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/claims/${claimId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ note: "too late" })
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/api/v1/expenses/claims/${claimId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);
  });

  it("rejects approval when a line's category has no ledger account mapped", async () => {
    const claim = await request(app.getHttpServer())
      .post("/api/v1/expenses/claims")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        employeeId,
        expenseDate: "2026-07-21",
        items: [{ categoryId: unmappedCategoryId, description: "Lunch", amountCents: 1500 }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/expenses/claims/${claim.body.id}/submit`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/expenses/claims/${claim.body.id}/approve`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ creditAccountId })
      .expect(400);
  });

  it("approves a submitted claim, posting a balanced journal entry to Accounting", async () => {
    const approved = await request(app.getHttpServer())
      .post(`/api/v1/expenses/claims/${claimId}/approve`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ creditAccountId })
      .expect(201);
    expect(approved.body.status).toBe("APPROVED");
    expect(approved.body.journalEntryId).toBeTruthy();

    const journalEntry = await request(app.getHttpServer())
      .get(`/api/v1/accounting/journal-entries/${approved.body.journalEntryId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(journalEntry.body.status).toBe("POSTED");
    const totalDebits = journalEntry.body.lines.reduce(
      (sum: number, l: { debitCents: number }) => sum + l.debitCents,
      0,
    );
    const totalCredits = journalEntry.body.lines.reduce(
      (sum: number, l: { creditCents: number }) => sum + l.creditCents,
      0,
    );
    expect(totalDebits).toBe(47500);
    expect(totalCredits).toBe(47500);

    await request(app.getHttpServer())
      .post(`/api/v1/expenses/claims/${claimId}/approve`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ creditAccountId })
      .expect(400);
  });

  it("rejects a different submitted claim with a reason", async () => {
    const claim = await request(app.getHttpServer())
      .post("/api/v1/expenses/claims")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        employeeId,
        expenseDate: "2026-07-22",
        items: [{ categoryId, description: "Rental car", amountCents: 8000 }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/expenses/claims/${claim.body.id}/submit`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);

    const rejected = await request(app.getHttpServer())
      .post(`/api/v1/expenses/claims/${claim.body.id}/reject`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ rejectionReason: "Missing receipt" })
      .expect(201);
    expect(rejected.body.status).toBe("REJECTED");
    expect(rejected.body.rejectionReason).toBe("Missing receipt");
  });

  it("allows cancelling a draft claim", async () => {
    const claim = await request(app.getHttpServer())
      .post("/api/v1/expenses/claims")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        employeeId,
        expenseDate: "2026-07-23",
        items: [{ categoryId, description: "Parking", amountCents: 500 }],
      })
      .expect(201);
    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/expenses/claims/${claim.body.id}/cancel`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(cancelled.body.status).toBe("CANCELLED");
  });

  it("marks an approved claim paid, and rejects doing so again", async () => {
    const paid = await request(app.getHttpServer())
      .post(`/api/v1/expenses/claims/${claimId}/mark-paid`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(paid.body.status).toBe("PAID");

    await request(app.getHttpServer())
      .post(`/api/v1/expenses/claims/${claimId}/mark-paid`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("reports claim counts, total paid, and spend by category", async () => {
    const summary = await request(app.getHttpServer())
      .get("/api/v1/expenses/reports/summary")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(summary.body.totalPaidCents).toBe(47500);

    const byStatus = await request(app.getHttpServer())
      .get("/api/v1/expenses/reports/claims-by-status")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    const paid = byStatus.body.find((s: { status: string }) => s.status === "PAID");
    expect(paid.count).toBe(1);

    const byCategory = await request(app.getHttpServer())
      .get("/api/v1/expenses/reports/spend-by-category")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    const travel = byCategory.body.find((c: { categoryName: string }) => c.categoryName === "Travel");
    expect(travel.totalCents).toBe(47500);
  });

  it("exports categories and claims as CSV", async () => {
    const categoriesCsv = await request(app.getHttpServer())
      .get("/api/v1/expenses/categories/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(categoriesCsv.headers["content-type"]).toContain("text/csv");
    expect(categoriesCsv.text).toContain("TRAVEL");

    const claimsCsv = await request(app.getHttpServer())
      .get("/api/v1/expenses/claims/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(claimsCsv.text).toContain("PAID");
  });

  it("exposes the same data over GraphQL as REST", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        query: `query { expensesSummary { totalPaidCents } expenseCategories(page: 1, pageSize: 10) { total } expenseClaims(page: 1, pageSize: 10) { total items { claimNumber status totalCents } } }`,
      })
      .expect(200);
    expect(res.body.data.expensesSummary.totalPaidCents).toBe(47500);
    expect(res.body.data.expenseCategories.total).toBe(2);
    expect(res.body.data.expenseClaims.total).toBeGreaterThanOrEqual(4);
  });

  it("enforces RBAC: a role without expenses permissions is forbidden", async () => {
    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "No Expenses", description: "Everything except expenses", permissionKeys: ["users:read"] })
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
      .get("/api/v1/expenses/claims")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/expenses/categories")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .send({ name: "Nope", code: "NOPE" })
      .expect(403);

    await prisma.user.delete({ where: { id: user.body.id } });
  });

  it("enforces tenant isolation: another company cannot see these expense records", async () => {
    const otherEmail = `expenses-isolation-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Other Expenses Co ${suffix}`,
        email: otherEmail,
        password,
        firstName: "Other",
        lastName: "Owner",
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/expenses/claims/${claimId}`)
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get("/api/v1/expenses/categories")
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(200);
    expect(list.body.total).toBe(0);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });
});
