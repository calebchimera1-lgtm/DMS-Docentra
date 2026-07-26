import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class AssetsReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(companyId: string) {
    const [activeAssetCount, disposedAssetCount, activeAgg] = await Promise.all([
      this.prisma.asset.count({ where: { companyId, deletedAt: null, status: "ACTIVE" } }),
      this.prisma.asset.count({ where: { companyId, deletedAt: null, status: "DISPOSED" } }),
      this.prisma.asset.aggregate({
        where: { companyId, deletedAt: null, status: "ACTIVE" },
        _sum: { purchaseCostCents: true, accumulatedDepreciationCents: true },
      }),
    ]);

    const totalPurchaseCostCents = activeAgg._sum.purchaseCostCents ?? 0;
    const totalAccumulatedDepreciationCents = activeAgg._sum.accumulatedDepreciationCents ?? 0;

    return {
      activeAssetCount,
      disposedAssetCount,
      totalPurchaseCostCents,
      totalAccumulatedDepreciationCents,
      totalNetBookValueCents: totalPurchaseCostCents - totalAccumulatedDepreciationCents,
    };
  }

  async byCategory(companyId: string) {
    const assets = await this.prisma.asset.findMany({
      where: { companyId, deletedAt: null, status: "ACTIVE" },
      select: { purchaseCostCents: true, accumulatedDepreciationCents: true, category: { select: { name: true } } },
    });

    const totals = new Map<string, { assetCount: number; netBookValueCents: number }>();
    for (const asset of assets) {
      const bucket = totals.get(asset.category.name) ?? { assetCount: 0, netBookValueCents: 0 };
      bucket.assetCount += 1;
      bucket.netBookValueCents += asset.purchaseCostCents - asset.accumulatedDepreciationCents;
      totals.set(asset.category.name, bucket);
    }

    return [...totals.entries()]
      .map(([categoryName, bucket]) => ({ categoryName, ...bucket }))
      .sort((a, b) => b.netBookValueCents - a.netBookValueCents);
  }
}
