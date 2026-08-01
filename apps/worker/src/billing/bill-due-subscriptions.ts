import type { BillingInterval } from "@omniflow/database";
import type { PrismaService } from "../prisma/prisma.service";

/**
 * Mirrors apps/api/src/modules/sales/common/document-number.util.ts and
 * apps/api/src/modules/billing/common/billing-period.util.ts. Duplicated
 * rather than imported: apps/worker and apps/api are independently
 * deployed applications with no cross-app src dependency, the same
 * boundary MaintenanceProcessor's own cleanupExpiredSessions() already
 * respects by working directly against Prisma instead of reaching into
 * apps/api's module tree. Both are pure, few-line functions — if either
 * one's behavior ever needs to change, change it in both places.
 */
function formatDocumentNumber(prefix: string, count: number): string {
  return `${prefix}-${String(count + 1).padStart(6, "0")}`;
}

const MONTHS_PER_INTERVAL: Record<BillingInterval, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
};

function addInterval(from: Date, interval: BillingInterval): Date {
  const months = MONTHS_PER_INTERVAL[interval];
  return new Date(
    Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth() + months,
      from.getUTCDate(),
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds(),
    ),
  );
}

export interface BillDueSubscriptionsResult {
  billed: number;
  failed: number;
}

/**
 * The automatic side of recurring billing: finds every ACTIVE
 * subscription whose current period has ended and bills it, the same
 * transaction SubscriptionsService.bill() runs for a manual call —
 * raise an Invoice, record the SubscriptionInvoice linking it to the
 * period, and roll currentPeriodStart/End forward by one interval.
 * Before this existed, a subscription's "recurring" invoice only ever
 * got raised if someone remembered to call the bill endpoint by hand.
 *
 * Each subscription is billed independently so one failure (e.g. a
 * plan that was deleted out from under a subscription) doesn't block
 * the rest. The same (subscriptionId, periodStart) uniqueness check
 * SubscriptionsService.bill() uses guards against double-billing if a
 * run overlaps with a manual bill for the same period.
 */
export async function billDueSubscriptions(
  prisma: PrismaService,
  now: Date = new Date(),
): Promise<BillDueSubscriptionsResult> {
  const due = await prisma.subscription.findMany({
    where: { status: "ACTIVE", currentPeriodEnd: { lte: now }, deletedAt: null },
    include: { plan: true },
  });

  let billed = 0;
  let failed = 0;

  for (const subscription of due) {
    try {
      const alreadyBilled = await prisma.subscriptionInvoice.count({
        where: { subscriptionId: subscription.id, periodStart: subscription.currentPeriodStart },
      });
      if (alreadyBilled > 0) {
        continue;
      }

      const periodStart = subscription.currentPeriodStart;
      const periodEnd = subscription.currentPeriodEnd;
      const amountCents = subscription.plan.priceCents * subscription.quantity;

      await prisma.$transaction(async (tx) => {
        const invoiceCount = await tx.invoice.count({ where: { companyId: subscription.companyId } });
        const invoice = await tx.invoice.create({
          data: {
            companyId: subscription.companyId,
            accountId: subscription.accountId,
            invoiceNumber: formatDocumentNumber("INV", invoiceCount),
            status: "SENT",
            items: [
              {
                description: `${subscription.plan.name} (${periodStart.toISOString().slice(0, 10)} – ${periodEnd
                  .toISOString()
                  .slice(0, 10)})`,
                quantity: subscription.quantity,
                unitPriceCents: subscription.plan.priceCents,
                totalCents: amountCents,
              },
            ] as unknown as object,
            totalCents: amountCents,
            currency: subscription.plan.currency,
            dueDate: periodEnd,
          },
        });

        await tx.subscriptionInvoice.create({
          data: {
            companyId: subscription.companyId,
            subscriptionId: subscription.id,
            invoiceId: invoice.id,
            periodStart,
            periodEnd,
            amountCents,
          },
        });

        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            currentPeriodStart: periodEnd,
            currentPeriodEnd: addInterval(periodEnd, subscription.plan.billingInterval),
          },
        });
      });

      billed++;
    } catch {
      failed++;
    }
  }

  return { billed, failed };
}
