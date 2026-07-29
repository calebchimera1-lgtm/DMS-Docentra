import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Billing module (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const ownerEmail = `billing-owner-${suffix}@test.com`;
  const viewerEmail = `billing-viewer-${suffix}@test.com`;
  const password = "Correct-Horse-Battery-9!";

  let ownerAccess: string;
  let accountId: string;
  let monthlyPlanId: string;
  let quarterlyPlanId: string;
  let yearlyPlanId: string;
  let trialPlanId: string;
  let subscriptionId: string;

  /** Just the date part, so period assertions read clearly. */
  const day = (iso: string) => iso.slice(0, 10);

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
        companyName: `Billing Co ${suffix}`,
        email: ownerEmail,
        password,
        firstName: "Olive",
        lastName: "Owner",
      })
      .expect(201);
    ownerAccess = reg.body.accessToken;

    const account = await request(app.getHttpServer())
      .post("/api/v1/crm/accounts")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "Subscribing Customer" })
      .expect(201);
    accountId = account.body.id;

    const mk = async (code: string, priceCents: number, billingInterval: string, trialDays = 0) => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/billing/plans")
        .set("Authorization", `Bearer ${ownerAccess}`)
        .send({ code, name: code, priceCents, billingInterval, trialDays })
        .expect(201);
      return res.body.id as string;
    };

    monthlyPlanId = await mk("M", 5_000, "MONTHLY");
    quarterlyPlanId = await mk("Q", 13_500, "QUARTERLY");
    yearlyPlanId = await mk("Y", 48_000, "YEARLY");
    trialPlanId = await mk("T", 9_900, "MONTHLY", 14);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, viewerEmail] } } });
    await app.close();
  });

  it("advances the period by exactly one interval for each billing interval", async () => {
    const start = "2026-01-15T00:00:00.000Z";

    const monthly = await request(app.getHttpServer())
      .post("/api/v1/billing/subscriptions")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ accountId, planId: monthlyPlanId, startDate: start, quantity: 2 })
      .expect(201);
    subscriptionId = monthly.body.id;
    expect(monthly.body.status).toBe("ACTIVE");
    expect(day(monthly.body.currentPeriodStart)).toBe("2026-01-15");
    expect(day(monthly.body.currentPeriodEnd)).toBe("2026-02-15");

    const quarterly = await request(app.getHttpServer())
      .post("/api/v1/billing/subscriptions")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ accountId, planId: quarterlyPlanId, startDate: start })
      .expect(201);
    expect(day(quarterly.body.currentPeriodEnd)).toBe("2026-04-15");

    const yearly = await request(app.getHttpServer())
      .post("/api/v1/billing/subscriptions")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ accountId, planId: yearlyPlanId, startDate: start })
      .expect(201);
    expect(day(yearly.body.currentPeriodEnd)).toBe("2027-01-15");
  });

  it("rolls a month-end start date forward without leaving a gap", async () => {
    // 31 January has no counterpart in February, so the period overflows
    // into March rather than clamping — periods still tile contiguously.
    const sub = await request(app.getHttpServer())
      .post("/api/v1/billing/subscriptions")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ accountId, planId: monthlyPlanId, startDate: "2026-01-31T00:00:00.000Z" })
      .expect(201);
    expect(day(sub.body.currentPeriodStart)).toBe("2026-01-31");
    expect(day(sub.body.currentPeriodEnd)).toBe("2026-03-03");

    const billed = await request(app.getHttpServer())
      .post(`/api/v1/billing/subscriptions/${sub.body.id}/bill`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({})
      .expect(201);
    // The next period starts exactly where the last one ended.
    expect(day(billed.body.currentPeriodStart)).toBe("2026-03-03");
  });

  it("starts a plan with a trial as TRIALING and refuses to bill it", async () => {
    const sub = await request(app.getHttpServer())
      .post("/api/v1/billing/subscriptions")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ accountId, planId: trialPlanId, startDate: "2026-01-15T00:00:00.000Z" })
      .expect(201);
    expect(sub.body.status).toBe("TRIALING");
    expect(day(sub.body.trialEndsAt)).toBe("2026-01-29");

    await request(app.getHttpServer())
      .post(`/api/v1/billing/subscriptions/${sub.body.id}/bill`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({})
      .expect(400);

    const activated = await request(app.getHttpServer())
      .post(`/api/v1/billing/subscriptions/${sub.body.id}/activate`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(activated.body.status).toBe("ACTIVE");
    expect(activated.body.trialEndsAt).toBeNull();

    // Activating twice is rejected.
    await request(app.getHttpServer())
      .post(`/api/v1/billing/subscriptions/${sub.body.id}/activate`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);
  });

  it("bills the current period, raising a real Sales invoice for price x quantity", async () => {
    const billed = await request(app.getHttpServer())
      .post(`/api/v1/billing/subscriptions/${subscriptionId}/bill`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({})
      .expect(201);

    expect(billed.body.invoices).toHaveLength(1);
    const entry = billed.body.invoices[0];
    // 2 seats x 5000.
    expect(entry.amountCents).toBe(10_000);
    expect(day(entry.periodStart)).toBe("2026-01-15");
    expect(day(entry.periodEnd)).toBe("2026-02-15");
    expect(entry.invoice.invoiceNumber).toMatch(/^INV-\d+$/);
    expect(entry.invoice.status).toBe("SENT");
    expect(entry.invoice.totalCents).toBe(10_000);

    // The period rolled forward by one interval.
    expect(day(billed.body.currentPeriodStart)).toBe("2026-02-15");
    expect(day(billed.body.currentPeriodEnd)).toBe("2026-03-15");

    // The invoice is a first-class Sales invoice, visible to that module.
    const invoices = await request(app.getHttpServer())
      .get("/api/v1/sales/invoices?page=1&pageSize=50")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    const match = invoices.body.items.find(
      (i: { invoiceNumber: string }) => i.invoiceNumber === entry.invoice.invoiceNumber,
    );
    expect(match).toBeTruthy();
    expect(match.totalCents).toBe(10_000);
  });

  it("refuses to invoice a period that has already been billed", async () => {
    const before = await request(app.getHttpServer())
      .get(`/api/v1/billing/subscriptions/${subscriptionId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    const billedPeriod = before.body.invoices[0];

    // Rewind the cursor onto a period that was already invoiced. Billing
    // always moves forward, so this is the only way to reach the guard —
    // and it is exactly the state a duplicated or retried call would create.
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        currentPeriodStart: new Date(billedPeriod.periodStart),
        currentPeriodEnd: new Date(billedPeriod.periodEnd),
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/billing/subscriptions/${subscriptionId}/bill`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({})
      .expect(409);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/billing/subscriptions/${subscriptionId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(after.body.invoices).toHaveLength(1);
  });

  it("pauses and resumes, blocking billing while paused", async () => {
    const paused = await request(app.getHttpServer())
      .post(`/api/v1/billing/subscriptions/${subscriptionId}/pause`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(paused.body.status).toBe("PAUSED");

    await request(app.getHttpServer())
      .post(`/api/v1/billing/subscriptions/${subscriptionId}/bill`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({})
      .expect(400);

    // Pausing twice is rejected.
    await request(app.getHttpServer())
      .post(`/api/v1/billing/subscriptions/${subscriptionId}/pause`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);

    const resumed = await request(app.getHttpServer())
      .post(`/api/v1/billing/subscriptions/${subscriptionId}/resume`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(resumed.body.status).toBe("ACTIVE");
  });

  it("rejects an inactive plan, and a plan or account from another company", async () => {
    const inactive = await request(app.getHttpServer())
      .post("/api/v1/billing/plans")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ code: "OFF", name: "Retired plan", priceCents: 100, isActive: false })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/billing/subscriptions")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ accountId, planId: inactive.body.id })
      .expect(400);

    const otherEmail = `billing-foreign-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Foreign Billing Co ${suffix}`,
        email: otherEmail,
        password,
        firstName: "Fern",
        lastName: "Foreign",
      })
      .expect(201);

    const foreignAccount = await request(app.getHttpServer())
      .post("/api/v1/crm/accounts")
      .set("Authorization", `Bearer ${otherReg.body.accessToken}`)
      .send({ name: "Foreign Customer" })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/v1/billing/subscriptions")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ accountId: foreignAccount.body.id, planId: monthlyPlanId })
      .expect(400);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });

  it("changes seat quantity and reflects it in the next invoice", async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/billing/subscriptions/${subscriptionId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ quantity: 5 })
      .expect(200);
    expect(updated.body.quantity).toBe(5);

    // Move the cursor off the already-billed period so billing can proceed.
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        currentPeriodStart: new Date("2026-06-15T00:00:00.000Z"),
        currentPeriodEnd: new Date("2026-07-15T00:00:00.000Z"),
      },
    });

    const billed = await request(app.getHttpServer())
      .post(`/api/v1/billing/subscriptions/${subscriptionId}/bill`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({})
      .expect(201);
    // 5 seats x 5000.
    expect(billed.body.invoices[0].amountCents).toBe(25_000);
  });

  it("guards deletion of billed subscriptions and plans that are in use", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/billing/subscriptions/${subscriptionId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/billing/plans/${monthlyPlanId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(403);

    // An unused plan deletes cleanly.
    const spare = await request(app.getHttpServer())
      .post("/api/v1/billing/plans")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ code: `SPARE-${suffix}`, name: "Spare", priceCents: 100 })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/api/v1/billing/plans/${spare.body.id}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(204);
  });

  it("cancels a subscription and refuses further billing or edits", async () => {
    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/billing/subscriptions/${subscriptionId}/cancel`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);
    expect(cancelled.body.status).toBe("CANCELLED");
    expect(cancelled.body.cancelledAt).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/api/v1/billing/subscriptions/${subscriptionId}/cancel`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/billing/subscriptions/${subscriptionId}/bill`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/billing/subscriptions/${subscriptionId}`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ quantity: 9 })
      .expect(400);
  });

  it("normalises MRR across billing intervals and excludes non-earning subscriptions", async () => {
    // Cancel everything first so the arithmetic below is unambiguous.
    const all = await request(app.getHttpServer())
      .get("/api/v1/billing/subscriptions?page=1&pageSize=100")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    for (const s of all.body.items) {
      if (s.status !== "CANCELLED") {
        await request(app.getHttpServer())
          .post(`/api/v1/billing/subscriptions/${s.id}/cancel`)
          .set("Authorization", `Bearer ${ownerAccess}`);
      }
    }

    // One of each interval: 5000 monthly + 13500/3 + 48000/12 = 13500.
    for (const planId of [monthlyPlanId, quarterlyPlanId, yearlyPlanId]) {
      await request(app.getHttpServer())
        .post("/api/v1/billing/subscriptions")
        .set("Authorization", `Bearer ${ownerAccess}`)
        .send({ accountId, planId })
        .expect(201);
    }

    const summary = await request(app.getHttpServer())
      .get("/api/v1/billing/reports/summary")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(summary.body.activeCount).toBe(3);
    expect(summary.body.mrrCents).toBe(5_000 + 4_500 + 4_000);
    expect(summary.body.arrCents).toBe((5_000 + 4_500 + 4_000) * 12);

    // Pausing one removes its contribution: it is no longer earning.
    const active = await request(app.getHttpServer())
      .get("/api/v1/billing/subscriptions?status=ACTIVE&page=1&pageSize=100")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    const yearlySub = active.body.items.find((s: { plan: { code: string } }) => s.plan.code === "Y");
    await request(app.getHttpServer())
      .post(`/api/v1/billing/subscriptions/${yearlySub.id}/pause`)
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(201);

    const afterPause = await request(app.getHttpServer())
      .get("/api/v1/billing/reports/summary")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(afterPause.body.mrrCents).toBe(5_000 + 4_500);
    expect(afterPause.body.pausedCount).toBe(1);

    const byStatus = await request(app.getHttpServer())
      .get("/api/v1/billing/reports/by-status")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(byStatus.body).toHaveLength(5);
  });

  it("exports plans and subscriptions as CSV", async () => {
    const plans = await request(app.getHttpServer())
      .get("/api/v1/billing/plans/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(plans.headers["content-type"]).toContain("text/csv");
    expect(plans.text).toContain("QUARTERLY");

    const subs = await request(app.getHttpServer())
      .get("/api/v1/billing/subscriptions/export")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);
    expect(subs.text).toContain("Subscribing Customer");
  });

  it("exposes the same data over GraphQL as REST", async () => {
    const rest = await request(app.getHttpServer())
      .get("/api/v1/billing/reports/summary")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .post("/api/v1/graphql")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({
        query: `query {
          billingSummary { activeCount pausedCount mrrCents arrCents invoicesRaised totalBilledCents }
          subscriptionsByStatus { status count }
          subscriptionPlans(page:1,pageSize:20) { total items { code priceCents billingInterval subscriptionCount } }
          subscriptions(page:1,pageSize:20) { total items { status quantity plan { code } account { name } } }
        }`,
      })
      .expect(200);

    expect(res.body.data.billingSummary.mrrCents).toBe(rest.body.mrrCents);
    expect(res.body.data.billingSummary.arrCents).toBe(rest.body.arrCents);
    expect(res.body.data.billingSummary.activeCount).toBe(rest.body.activeCount);
    expect(res.body.data.subscriptionsByStatus).toHaveLength(5);
    expect(res.body.data.subscriptionPlans.total).toBeGreaterThanOrEqual(4);
    expect(res.body.data.subscriptions.total).toBeGreaterThanOrEqual(3);
  });

  it("enforces RBAC: a role without billing permissions is forbidden", async () => {
    const role = await request(app.getHttpServer())
      .post("/api/v1/roles")
      .set("Authorization", `Bearer ${ownerAccess}`)
      .send({ name: "No Billing", description: "Everything except billing", permissionKeys: ["users:read"] })
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
      .get("/api/v1/billing/plans")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .get("/api/v1/billing/subscriptions")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/billing/subscriptions/${subscriptionId}/bill`)
      .set("Authorization", `Bearer ${viewerAccess}`)
      .send({})
      .expect(403);

    await request(app.getHttpServer())
      .get("/api/v1/billing/reports/summary")
      .set("Authorization", `Bearer ${viewerAccess}`)
      .expect(403);

    await prisma.user.delete({ where: { id: user.body.id } });
  });

  it("enforces tenant isolation: another company sees none of this", async () => {
    const otherEmail = `billing-isolation-${suffix}@test.com`;
    const otherReg = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        companyName: `Other Billing Co ${suffix}`,
        email: otherEmail,
        password,
        firstName: "Other",
        lastName: "Owner",
      })
      .expect(201);
    const otherAccess = otherReg.body.accessToken;

    await request(app.getHttpServer())
      .get(`/api/v1/billing/subscriptions/${subscriptionId}`)
      .set("Authorization", `Bearer ${otherAccess}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/billing/plans/${monthlyPlanId}`)
      .set("Authorization", `Bearer ${otherAccess}`)
      .expect(404);

    const list = await request(app.getHttpServer())
      .get("/api/v1/billing/subscriptions")
      .set("Authorization", `Bearer ${otherAccess}`)
      .expect(200);
    expect(list.body.total).toBe(0);

    const summary = await request(app.getHttpServer())
      .get("/api/v1/billing/reports/summary")
      .set("Authorization", `Bearer ${otherAccess}`)
      .expect(200);
    expect(summary.body.mrrCents).toBe(0);
    expect(summary.body.invoicesRaised).toBe(0);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });
});
