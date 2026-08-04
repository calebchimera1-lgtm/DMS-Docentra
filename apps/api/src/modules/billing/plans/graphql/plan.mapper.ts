import type { SubscriptionPlanItemType } from "./plan.type";

interface PrismaPlanWithCount {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  billingInterval: string;
  trialDays: number;
  isActive: boolean;
  _count: { subscriptions: number };
}

export function toSubscriptionPlanItemType(plan: PrismaPlanWithCount): SubscriptionPlanItemType {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description ?? undefined,
    priceCents: plan.priceCents,
    currency: plan.currency,
    billingInterval: plan.billingInterval,
    trialDays: plan.trialDays,
    isActive: plan.isActive,
    subscriptionCount: plan._count.subscriptions,
  };
}
