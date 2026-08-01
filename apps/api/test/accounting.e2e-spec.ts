import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Accounting module (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const ownerEmail = `accounting-owner-${suffix}@test.com`;
  const viewerEmail = `accounting-viewer-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";

  let ownerAccess: string;
  let bankId: string;
  let arId: string;
  let revenueId: string;
  let journalEntryId: string;
  let invoiceId: string;

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
        companyName: `Accounting Co ${suffix}`,
        email: ownerEmail,
        password,
        firstName: "Owner",
        lastName: "Test",
      })
      .expect(201);
    ownerAccess = reg.body.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, viewerEmail] } } });
    await app.close();
  });

  it("auto-provisions a chart of accounts on registration (1000/1100/4000 already exist)", async () => {
    const accounts = await request(app.getHttpServer())
      .get("/api/v1/accounting/ledger-accounts?pageSize=50")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(accounts.body.total).toBe(8);
    expect(accounts.body.items.map((a: { code: string }) => a.code)).toEqual(
      expect.arrayContaining(["1000", "1100", "4000"]),
    );
  });

  it("creates ledger accounts (codes distinct from the auto-provisioned defaults) and rejects a duplicate code", async () => {
    // Codes 9000/9100/9400 are deliberately outside the default chart of
    // accounts (1000-5100) so this company's own bank/AR/revenue accounts
    // exist alongside the auto-provisioned ones, not in place of them.
    const bank = await request(app.getHttpServer())
      .post("/api/v1/accounting/ledger-accounts")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ code: "9000", name: "Business Bank Account", type: "ASSET" })
      .expect(201);
    bankId = bank.body.id;

    const ar = await request(app.getHttpServer())
      .post("/api/v1/accounting/ledger-accounts")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ code: "9100", name: "Trade Receivables", type: "ASSET" })
      .expect(201);
    arId = ar.body.id;

    const revenue = await request(app.getHttpServer())
      .post("/api/v1/accounting/ledger-accounts")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ code: "9400", name: "Consulting Revenue", type: "REVENUE" })
      .expect(201);
    revenueId = revenue.body.id;

    await request(app.getHttpServer())
      .post("/api/v1/accounting/ledger-accounts")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ code: "9000", name: "Duplicate", type: "ASSET" })
      .expect(409);

    // Also rejects colliding with an auto-provisioned default's code.
    await request(app.getHttpServer())
      .post("/api/v1/accounting/ledger-accounts")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ code: "1000", name: "Another Cash Account", type: "ASSET" })
      .expect(409);
  });

  it("rejects an unbalanced journal entry and a line with both sides set", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/accounting/journal-entries")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        entryDate: "2026-07-24",
        lines: [
          { ledgerAccountId: arId, debitCents: 10000 },
          { ledgerAccountId: revenueId, creditCents: 5000 },
        ],
      })
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/v1/accounting/journal-entries")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        entryDate: "2026-07-24",
        lines: [
          { ledgerAccountId: arId, debitCents: 100, creditCents: 100 },
          { ledgerAccountId: revenueId, creditCents: 100 },
        ],
      })
      .expect(400);
  });

  it("creates a balanced draft journal entry", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/accounting/journal-entries")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        entryDate: "2026-07-24",
        memo: "Revenue recognition",
        lines: [
          { ledgerAccountId: arId, debitCents: 50000, description: "AR" },
          { ledgerAccountId: revenueId, creditCents: 50000, description: "Revenue" },
        ],
      })
      .expect(201);
    journalEntryId = res.body.id;
    expect(res.body.entryNumber).toMatch(/^JE-\d{6}$/);
    expect(res.body.status).toBe("DRAFT");
  });

  it("posts a journal entry, making it immutable", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/accounting/journal-entries/${journalEntryId}/post`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(res.body.status).toBe("POSTED");

    await request(app.getHttpServer())
      .delete(`/api/v1/accounting/journal-entries/${journalEntryId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/accounting/journal-entries/${journalEntryId}/post`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("records a payment that auto-posts a journal entry and marks a Sales invoice paid", async () => {
    const account = await request(app.getHttpServer())
      .post("/api/v1/crm/accounts")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Accounting Test Account" })
      .expect(201);

    const invoice = await request(app.getHttpServer())
      .post("/api/v1/sales/invoices")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        accountId: account.body.id,
        items: [{ description: "Consulting", quantity: 1, unitPriceCents: 75000 }],
      })
      .expect(201);
    invoiceId = invoice.body.id;
    expect(invoice.body.status).toBe("DRAFT");

    const payment = await request(app.getHttpServer())
      .post("/api/v1/accounting/payments")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        amountCents: 75000,
        paymentDate: "2026-07-24",
        debitAccountId: bankId,
        creditAccountId: arId,
        invoiceId,
        reference: "Wire-001",
      })
      .expect(201);
    expect(payment.body.journalEntry.entryNumber).toMatch(/^JE-\d{6}$/);

    const journalEntry = await request(app.getHttpServer())
      .get(`/api/v1/accounting/journal-entries/${payment.body.journalEntry.id}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(journalEntry.body.status).toBe("POSTED");
    expect(journalEntry.body.lines).toHaveLength(2);

    const paidInvoice = await request(app.getHttpServer())
      .get(`/api/v1/sales/invoices/${invoiceId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(paidInvoice.body.status).toBe("PAID");
    expect(paidInvoice.body.paidAt).toBeTruthy();

    await request(app.getHttpServer())
      .post("/api/v1/accounting/payments")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ amountCents: 75000, paymentDate: "2026-07-24", debitAccountId: bankId, creditAccountId: arId, invoiceId })
      .expect(400);
  });

  it("rejects a payment with matching debit and credit accounts", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/accounting/payments")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ amountCents: 100, paymentDate: "2026-07-24", debitAccountId: bankId, creditAccountId: bankId })
      .expect(400);
  });

  it("reports balances by type and a P&L summary", async () => {
    // 50000 posted manually to the custom "Consulting Revenue" account,
    // plus 75000 auto-posted to the default "Sales Revenue" account when
    // the invoice above was created — both are REVENUE-type accounts, so
    // both count toward the totals here.
    const summary = await request(app.getHttpServer())
      .get("/api/v1/accounting/reports/summary")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(summary.body.totalRevenueCents).toBe(125000);
    expect(summary.body.netIncomeCents).toBe(125000);

    const byType = await request(app.getHttpServer())
      .get("/api/v1/accounting/reports/balances-by-type")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    const revenue = byType.body.types.find((t: { type: string }) => t.type === "REVENUE");
    expect(revenue.creditCents).toBe(125000);
    expect(revenue.balanceCents).toBe(125000);
  });

  it("exports ledger accounts and journal entries as CSV", async () => {
    const accountsCsv = await request(app.getHttpServer())
      .get("/api/v1/accounting/ledger-accounts/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(accountsCsv.headers["content-type"]).toContain("text/csv");
    expect(accountsCsv.text).toContain("Bank");

    const entriesCsv = await request(app.getHttpServer())
      .get("/api/v1/accounting/journal-entries/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(entriesCsv.text).toContain("POSTED");
  });

  it("exposes the same data over GraphQL as REST", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        query: `query { accountingSummary { totalRevenueCents netIncomeCents } ledgerAccounts(page: 1, pageSize: 50) { total } payments(page: 1, pageSize: 10) { total items { amountCents invoiceNumber } } }`,
      })
      .expect(200);
    expect(res.body.data.accountingSummary.totalRevenueCents).toBe(125000);
    // 8 auto-provisioned defaults + 3 custom accounts created above.
    expect(res.body.data.ledgerAccounts.total).toBe(11);
    expect(res.body.data.payments.items[0].amountCents).toBe(75000);
  });

  it("refuses to delete a ledger account with journal activity", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/accounting/ledger-accounts/${revenueId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);
  });

  it("enforces RBAC: a role without accounting permissions is forbidden", async () => {
    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "No Accounting", description: "Everything except accounting", permissionKeys: ["users:read"] })
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
      .get("/api/v1/accounting/ledger-accounts")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/accounting/journal-entries")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .send({
        entryDate: "2026-07-24",
        lines: [
          { ledgerAccountId: arId, debitCents: 100 },
          { ledgerAccountId: revenueId, creditCents: 100 },
        ],
      })
      .expect(403);

    await prisma.user.delete({ where: { id: user.body.id } });
  });

  it("enforces tenant isolation: another company cannot see these accounting records", async () => {
    const otherEmail = `accounting-other-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Other Accounting Co ${suffix}`,
        email: otherEmail,
        password,
        firstName: "Other",
        lastName: "Owner",
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/accounting/ledger-accounts/${bankId}`)
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get("/api/v1/accounting/journal-entries")
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(200);
    expect(list.body.total).toBe(0);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });
});
