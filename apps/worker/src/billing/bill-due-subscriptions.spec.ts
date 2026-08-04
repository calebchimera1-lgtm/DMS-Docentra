import { billDueSubscriptions } from "./bill-due-subscriptions";

describe("billDueSubscriptions", () => {
  const now = new Date("2026-08-01T00:00:00.000Z");

  function makeSubscription(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "sub-1",
      companyId: "company-1",
      accountId: "account-1",
      quantity: 2,
      currentPeriodStart: new Date("2026-07-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z"),
      plan: { name: "Pro", priceCents: 5000, currency: "USD", billingInterval: "MONTHLY" },
      ...overrides,
    };
  }

  function makeTx() {
    return {
      invoice: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({ id: "inv-1" }) },
      subscriptionInvoice: { create: jest.fn().mockResolvedValue({}) },
      subscription: { update: jest.fn().mockResolvedValue({}) },
    };
  }

  function makePrisma() {
    const tx = makeTx();
    return {
      subscription: {
        findMany: jest.fn(),
      },
      subscriptionInvoice: {
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn(async (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => fn(tx)),
      __tx: tx,
    };
  }

  it("bills every due subscription once, raising an invoice and rolling the period forward", async () => {
    const prisma = makePrisma();
    prisma.subscription.findMany.mockResolvedValue([makeSubscription()]);

    const result = await billDueSubscriptions(prisma as never, now);

    expect(prisma.subscription.findMany).toHaveBeenCalledWith({
      where: { status: "ACTIVE", currentPeriodEnd: { lte: now }, deletedAt: null },
      include: { plan: true },
    });
    expect(prisma.__tx.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ companyId: "company-1", totalCents: 10000 }) }),
    );
    expect(prisma.__tx.subscriptionInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subscriptionId: "sub-1", amountCents: 10000 }),
      }),
    );
    expect(prisma.__tx.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: {
        currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
        currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
      },
    });
    expect(result).toEqual({ billed: 1, failed: 0 });
  });

  it("skips a subscription whose period was already invoiced, without failing the run", async () => {
    const prisma = makePrisma();
    prisma.subscription.findMany.mockResolvedValue([makeSubscription()]);
    prisma.subscriptionInvoice.count.mockResolvedValue(1);

    const result = await billDueSubscriptions(prisma as never, now);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result).toEqual({ billed: 0, failed: 0 });
  });

  it("counts a failure for one subscription without stopping the rest", async () => {
    const prisma = makePrisma();
    prisma.subscription.findMany.mockResolvedValue([
      makeSubscription({ id: "sub-fails" }),
      makeSubscription({ id: "sub-ok" }),
    ]);
    prisma.$transaction
      .mockImplementationOnce(() => {
        throw new Error("boom");
      })
      .mockImplementationOnce(async (fn: (tx: typeof prisma.__tx) => Promise<unknown>) => fn(prisma.__tx));

    const result = await billDueSubscriptions(prisma as never, now);

    expect(result).toEqual({ billed: 1, failed: 1 });
  });
});
