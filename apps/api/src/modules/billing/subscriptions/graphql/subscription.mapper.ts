import type { SubscriptionItemType } from "./subscription.type";

interface PrismaSubscriptionWithRelations {
  id: string;
  status: string;
  quantity: number;
  startDate: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
  account: { id: string; name: string };
  plan: { id: string; code: string; name: string; priceCents: number; billingInterval: string };
  invoices: {
    id: string;
    periodStart: Date;
    periodEnd: Date;
    amountCents: number;
    invoice: { invoiceNumber: string; status: string };
  }[];
}

export function toSubscriptionItemType(subscription: PrismaSubscriptionWithRelations): SubscriptionItemType {
  return {
    id: subscription.id,
    status: subscription.status,
    quantity: subscription.quantity,
    startDate: subscription.startDate,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    trialEndsAt: subscription.trialEndsAt ?? undefined,
    account: subscription.account,
    plan: subscription.plan,
    invoices: subscription.invoices.map((i) => ({
      id: i.id,
      periodStart: i.periodStart,
      periodEnd: i.periodEnd,
      amountCents: i.amountCents,
      invoiceNumber: i.invoice.invoiceNumber,
      invoiceStatus: i.invoice.status,
    })),
  };
}
