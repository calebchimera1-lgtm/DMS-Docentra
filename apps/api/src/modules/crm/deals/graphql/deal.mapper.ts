import type { CrmDealType } from "./deal.type";

interface PrismaDealWithRelations {
  id: string;
  title: string;
  valueCents: number;
  currency: string;
  stage: string;
  expectedCloseDate: Date | null;
  account: { id: string; name: string } | null;
}

export function toCrmDealType(deal: PrismaDealWithRelations): CrmDealType {
  return {
    id: deal.id,
    title: deal.title,
    valueCents: deal.valueCents,
    currency: deal.currency,
    stage: deal.stage,
    expectedCloseDate: deal.expectedCloseDate ?? undefined,
    account: deal.account ?? undefined,
  };
}
