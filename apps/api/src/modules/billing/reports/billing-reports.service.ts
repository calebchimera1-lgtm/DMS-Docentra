import { Injectable } from "@nestjs/common";
import type { SubscriptionStatus } from "@omniflow/database";
import { PrismaService } from "../../../prisma/prisma.service";
import { toMonthlyRecurringCents } from "../common/billing-period.util";

const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ["TRIALING", "ACTIVE", "PAUSED", "CANCELLED", "EXPIRED"];

@Injectable()
export class BillingReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(companyId: string) {
    const base = { companyId, deletedAt: null };

    const [trialingCount, activeCount, pausedCount, cancelledCount, planCount, billedAgg] = await Promise.all([
      this.prisma.subscription.count({ where: { ...base, status: "TRIALING" } }),
      this.prisma.subscription.count({ where: { ...base, status: "ACTIVE" } }),
      this.prisma.subscription.count({ where: { ...base, status: "PAUSED" } }),
      this.prisma.subscription.count({ where: { ...base, status: "CANCELLED" } }),
      this.prisma.subscriptionPlan.count({ where: { ...base, isActive: true } }),
      this.prisma.subscriptionInvoice.aggregate({
        where: { companyId, subscription: { deletedAt: null } },
        _sum: { amountCents: true },
        _count: { _all: true },
      }),
    ]);

    // MRR counts only subscriptions that are actually earning: a paused or
    // cancelled one bills nothing, and a trial has not started paying yet.
    // Each is normalised onto a monthly footing so plans on different
    // intervals can be summed together.
    const earning = await this.prisma.subscription.findMany({
      where: { ...base, status: "ACTIVE" },
      select: { quantity: true, plan: { select: { priceCents: true, billingInterval: true } } },
    });
    const mrrCents = earning.reduce(
      (sum, s) => sum + toMonthlyRecurringCents(s.plan.priceCents * s.quantity, s.plan.billingInterval),
      0,
    );

    return {
      trialingCount,
      activeCount,
      pausedCount,
      cancelledCount,
      activePlanCount: planCount,
      mrrCents,
      // Annualised run rate, the usual companion figure to MRR.
      arrCents: mrrCents * 12,
      invoicesRaised: billedAgg._count._all,
      totalBilledCents: billedAgg._sum.amountCents ?? 0,
    };
  }

  async byStatus(companyId: string) {
    const grouped = await this.prisma.subscription.groupBy({
      by: ["status"],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
    });
    const countByStatus = new Map(grouped.map((g) => [g.status, g._count._all]));
    return SUBSCRIPTION_STATUSES.map((status) => ({ status, count: countByStatus.get(status) ?? 0 }));
  }
}
