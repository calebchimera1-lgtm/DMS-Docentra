import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Assets module (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const ownerEmail = `assets-owner-${suffix}@test.com`;
  const viewerEmail = `assets-viewer-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";

  let ownerAccess: string;
  let assetAccountId: string;
  let expenseAccountId: string;
  let accumAccountId: string;
  let cashAccountId: string;
  let gainLossAccountId: string;
  let categoryId: string;
  let unmappedCategoryId: string;
  let assetId: string;

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
        companyName: `Assets Co ${suffix}`,
        email: ownerEmail,
        password,
        firstName: "Owner",
        lastName: "Test",
      })
      .expect(201);
    ownerAccess = reg.body.accessToken;

    const [assetAcct, expenseAcct, accumAcct, cashAcct, gainLossAcct] = await Promise.all([
      request(app.getHttpServer())
        .post("/api/v1/accounting/ledger-accounts")
        .set("Authorization", `Bearer ${ownerAccess}`)
        .send({ code: "1500", name: "Computer Equipment", type: "ASSET" }),
      request(app.getHttpServer())
        .post("/api/v1/accounting/ledger-accounts")
        .set("Authorization", `Bearer ${ownerAccess}`)
        .send({ code: "6200", name: "Depreciation Expense", type: "EXPENSE" }),
      request(app.getHttpServer())
        .post("/api/v1/accounting/ledger-accounts")
        .set("Authorization", `Bearer ${ownerAccess}`)
        .send({ code: "1510", name: "Accumulated Depreciation", type: "ASSET" }),
      request(app.getHttpServer())
        .post("/api/v1/accounting/ledger-accounts")
        .set("Authorization", `Bearer ${ownerAccess}`)
        .send({ code: "1000", name: "Bank", type: "ASSET" }),
      request(app.getHttpServer())
        .post("/api/v1/accounting/ledger-accounts")
        .set("Authorization", `Bearer ${ownerAccess}`)
        .send({ code: "7000", name: "Gain/Loss on Disposal", type: "REVENUE" }),
    ]);
    assetAccountId = assetAcct.body.id;
    expenseAccountId = expenseAcct.body.id;
    accumAccountId = accumAcct.body.id;
    cashAccountId = cashAcct.body.id;
    gainLossAccountId = gainLossAcct.body.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, viewerEmail] } } });
    await app.close();
  });

  it("creates asset categories and rejects a duplicate code", async () => {
    const category = await request(app.getHttpServer())
      .post("/api/v1/assets/categories")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        name: "Computers",
        code: "COMP",
        defaultUsefulLifeMonths: 36,
        assetAccountId,
        depreciationExpenseAccountId: expenseAccountId,
        accumulatedDepreciationAccountId: accumAccountId,
      })
      .expect(201);
    categoryId = category.body.id;

    const unmapped = await request(app.getHttpServer())
      .post("/api/v1/assets/categories")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Furniture", code: "FURN" })
      .expect(201);
    unmappedCategoryId = unmapped.body.id;

    await request(app.getHttpServer())
      .post("/api/v1/assets/categories")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Duplicate", code: "COMP" })
      .expect(409);
  });

  it("registers an asset, defaulting useful life from its category", async () => {
    const asset = await request(app.getHttpServer())
      .post("/api/v1/assets/assets")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ categoryId, name: "MacBook Pro #1", purchaseDate: "2026-01-01", purchaseCostCents: 360000 })
      .expect(201);
    assetId = asset.body.id;
    expect(asset.body.usefulLifeMonths).toBe(36);
    expect(asset.body.status).toBe("ACTIVE");
    expect(asset.body.assetNumber).toMatch(/^AST-/);
  });

  it("rejects registering an asset against a category that doesn't belong to this company", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/assets/assets")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        categoryId: "00000000-0000-0000-0000-000000000000",
        name: "Bad",
        purchaseDate: "2026-01-01",
        purchaseCostCents: 100,
      })
      .expect(400);
  });

  it("rejects generating depreciation for an asset whose category has no mapped accounts", async () => {
    const asset = await request(app.getHttpServer())
      .post("/api/v1/assets/assets")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ categoryId: unmappedCategoryId, name: "Desk", purchaseDate: "2026-01-01", purchaseCostCents: 50000 })
      .expect(201);

    const run = await request(app.getHttpServer())
      .post("/api/v1/assets/depreciation-runs")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ periodDate: "2026-01-31" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/assets/depreciation-runs/${run.body.id}/generate`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/assets/depreciation-runs/${run.body.id}/cancel`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);

    await prisma.asset.delete({ where: { id: asset.body.id } });
  });

  it("generates one period of straight-line depreciation, posting a balanced journal entry", async () => {
    const run = await request(app.getHttpServer())
      .post("/api/v1/assets/depreciation-runs")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ periodDate: "2026-01-31" })
      .expect(201);
    expect(run.body.status).toBe("DRAFT");

    const generated = await request(app.getHttpServer())
      .post(`/api/v1/assets/depreciation-runs/${run.body.id}/generate`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(generated.body.status).toBe("POSTED");

    const asset = await request(app.getHttpServer())
      .get(`/api/v1/assets/assets/${assetId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    // 360000 / 36 months = 10000 cents/month
    expect(asset.body.accumulatedDepreciationCents).toBe(10000);

    const journalEntry = await request(app.getHttpServer())
      .get(`/api/v1/accounting/journal-entries/${generated.body.journalEntryId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(journalEntry.body.status).toBe("POSTED");
    const totalDebits = journalEntry.body.lines.reduce((s: number, l: { debitCents: number }) => s + l.debitCents, 0);
    const totalCredits = journalEntry.body.lines.reduce(
      (s: number, l: { creditCents: number }) => s + l.creditCents,
      0,
    );
    expect(totalDebits).toBe(10000);
    expect(totalCredits).toBe(10000);

    await request(app.getHttpServer())
      .post(`/api/v1/assets/depreciation-runs/${run.body.id}/generate`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("blocks deleting an asset with depreciation history, but allows editing it", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/assets/assets/${assetId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/assets/assets/${assetId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ note: "Assigned to engineering" })
      .expect(200);
    expect(updated.body.note).toBe("Assigned to engineering");
  });

  it("disposes of an asset for a gain, posting a balanced journal entry", async () => {
    // Net book value = 360000 - 10000 = 350000. Proceeds 400000 -> gain of 50000.
    const disposed = await request(app.getHttpServer())
      .post(`/api/v1/assets/assets/${assetId}/dispose`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ disposalDate: "2026-02-01", disposalProceedsCents: 400000, cashAccountId, gainLossAccountId })
      .expect(201);
    expect(disposed.body.status).toBe("DISPOSED");

    const journalEntry = await request(app.getHttpServer())
      .get(`/api/v1/accounting/journal-entries/${disposed.body.disposalJournalEntry.id}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    const totalDebits = journalEntry.body.lines.reduce((s: number, l: { debitCents: number }) => s + l.debitCents, 0);
    const totalCredits = journalEntry.body.lines.reduce(
      (s: number, l: { creditCents: number }) => s + l.creditCents,
      0,
    );
    expect(totalDebits).toBe(410000); // 10000 accumDep + 400000 proceeds
    expect(totalCredits).toBe(410000); // 360000 cost + 50000 gain
    const gainLine = journalEntry.body.lines.find((l: { ledgerAccountId: string }) => l.ledgerAccountId === gainLossAccountId);
    expect(gainLine.creditCents).toBe(50000);

    await request(app.getHttpServer())
      .post(`/api/v1/assets/assets/${assetId}/dispose`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ disposalDate: "2026-02-01", gainLossAccountId })
      .expect(400);
  });

  it("disposes of an asset for a loss when proceeds are below net book value", async () => {
    const asset = await request(app.getHttpServer())
      .post("/api/v1/assets/assets")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ categoryId, name: "Old Server", purchaseDate: "2025-01-01", purchaseCostCents: 100000, usefulLifeMonths: 10 })
      .expect(201);

    const run = await request(app.getHttpServer())
      .post("/api/v1/assets/depreciation-runs")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ periodDate: "2026-01-31" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/assets/depreciation-runs/${run.body.id}/generate`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);

    // Net book value = 100000 - 10000 = 90000. Proceeds 50000 -> loss of 40000.
    const disposed = await request(app.getHttpServer())
      .post(`/api/v1/assets/assets/${asset.body.id}/dispose`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ disposalDate: "2026-02-01", disposalProceedsCents: 50000, cashAccountId, gainLossAccountId })
      .expect(201);

    const journalEntry = await request(app.getHttpServer())
      .get(`/api/v1/accounting/journal-entries/${disposed.body.disposalJournalEntry.id}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    const totalDebits = journalEntry.body.lines.reduce((s: number, l: { debitCents: number }) => s + l.debitCents, 0);
    const totalCredits = journalEntry.body.lines.reduce(
      (s: number, l: { creditCents: number }) => s + l.creditCents,
      0,
    );
    expect(totalDebits).toBe(totalCredits);
    const lossLine = journalEntry.body.lines.find((l: { ledgerAccountId: string }) => l.ledgerAccountId === gainLossAccountId);
    expect(lossLine.debitCents).toBe(40000);
  });

  it("reports active/disposed counts, net book value, and value by category", async () => {
    const summary = await request(app.getHttpServer())
      .get("/api/v1/assets/reports/summary")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(summary.body.disposedAssetCount).toBeGreaterThanOrEqual(2);

    const byCategory = await request(app.getHttpServer())
      .get("/api/v1/assets/reports/by-category")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(Array.isArray(byCategory.body)).toBe(true);
  });

  it("exports categories, assets, and depreciation runs as CSV", async () => {
    const categoriesCsv = await request(app.getHttpServer())
      .get("/api/v1/assets/categories/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(categoriesCsv.headers["content-type"]).toContain("text/csv");
    expect(categoriesCsv.text).toContain("COMP");

    const assetsCsv = await request(app.getHttpServer())
      .get("/api/v1/assets/assets/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(assetsCsv.text).toContain("DISPOSED");

    const runsCsv = await request(app.getHttpServer())
      .get("/api/v1/assets/depreciation-runs/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(runsCsv.text).toContain("POSTED");
  });

  it("exposes the same data over GraphQL as REST", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        query: `query { assetsSummary { disposedAssetCount } assetCategories(page: 1, pageSize: 10) { total } assets(page: 1, pageSize: 10) { total items { assetNumber status } } depreciationRuns(page: 1, pageSize: 10) { total items { status lineCount } } }`,
      })
      .expect(200);
    expect(res.body.data.assetsSummary.disposedAssetCount).toBeGreaterThanOrEqual(2);
    expect(res.body.data.assetCategories.total).toBe(2);
    expect(res.body.data.assets.total).toBeGreaterThanOrEqual(2);
    expect(res.body.data.depreciationRuns.total).toBeGreaterThanOrEqual(2);
  });

  it("enforces RBAC: a role without assets permissions is forbidden", async () => {
    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "No Assets", description: "Everything except assets", permissionKeys: ["users:read"] })
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
      .get("/api/v1/assets/assets")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/assets/categories")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .send({ name: "Nope", code: "NOPE" })
      .expect(403);

    await prisma.user.delete({ where: { id: user.body.id } });
  });

  it("enforces tenant isolation: another company cannot see these asset records", async () => {
    const otherEmail = `assets-isolation-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Other Assets Co ${suffix}`,
        email: otherEmail,
        password,
        firstName: "Other",
        lastName: "Owner",
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/assets/assets/${assetId}`)
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get("/api/v1/assets/categories")
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .expect(200);
    expect(list.body.total).toBe(0);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });
});
