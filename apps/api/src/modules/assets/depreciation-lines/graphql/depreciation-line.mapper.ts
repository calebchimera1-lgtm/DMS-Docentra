import type { DepreciationLineItemType } from "./depreciation-line.type";

interface PrismaDepreciationLineWithRelations {
  id: string;
  amountCents: number;
  accumulatedAfterCents: number;
  asset: { id: string; assetNumber: string; name: string };
  depreciationRun: { id: string; periodDate: Date; status: string };
}

export function toDepreciationLineItemType(line: PrismaDepreciationLineWithRelations): DepreciationLineItemType {
  return {
    id: line.id,
    amountCents: line.amountCents,
    accumulatedAfterCents: line.accumulatedAfterCents,
    asset: line.asset,
    depreciationRun: line.depreciationRun,
  };
}
