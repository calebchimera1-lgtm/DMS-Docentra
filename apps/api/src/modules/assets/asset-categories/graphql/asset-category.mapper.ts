import type { AssetCategoryItemType } from "./asset-category.type";

interface PrismaAssetCategory {
  id: string;
  name: string;
  code: string;
  defaultUsefulLifeMonths: number;
  assetAccountId: string | null;
  depreciationExpenseAccountId: string | null;
  accumulatedDepreciationAccountId: string | null;
  isActive: boolean;
}

export function toAssetCategoryItemType(category: PrismaAssetCategory): AssetCategoryItemType {
  return {
    id: category.id,
    name: category.name,
    code: category.code,
    defaultUsefulLifeMonths: category.defaultUsefulLifeMonths,
    assetAccountId: category.assetAccountId ?? undefined,
    depreciationExpenseAccountId: category.depreciationExpenseAccountId ?? undefined,
    accumulatedDepreciationAccountId: category.accumulatedDepreciationAccountId ?? undefined,
    isActive: category.isActive,
  };
}
