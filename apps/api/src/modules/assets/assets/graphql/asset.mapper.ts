import type { AssetItemType } from "./asset.type";

interface PrismaAssetWithRelations {
  id: string;
  assetNumber: string;
  name: string;
  purchaseDate: Date;
  purchaseCostCents: number;
  salvageValueCents: number;
  usefulLifeMonths: number;
  accumulatedDepreciationCents: number;
  currency: string;
  status: string;
  category: { id: string; name: string; code: string };
}

export function toAssetItemType(asset: PrismaAssetWithRelations): AssetItemType {
  return {
    id: asset.id,
    assetNumber: asset.assetNumber,
    name: asset.name,
    purchaseDate: asset.purchaseDate,
    purchaseCostCents: asset.purchaseCostCents,
    salvageValueCents: asset.salvageValueCents,
    usefulLifeMonths: asset.usefulLifeMonths,
    accumulatedDepreciationCents: asset.accumulatedDepreciationCents,
    currency: asset.currency,
    status: asset.status,
    category: asset.category,
  };
}
