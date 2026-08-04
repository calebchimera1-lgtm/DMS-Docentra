import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

const MOVEMENT_TYPES = ["RECEIPT", "SALE", "ADJUSTMENT", "TRANSFER_IN", "TRANSFER_OUT", "RETURN"] as const;

@Injectable()
export class InventoryReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(companyId: string) {
    const [warehouseCount, stockItems, grouped] = await Promise.all([
      this.prisma.warehouse.count({ where: { companyId, deletedAt: null, isActive: true } }),
      this.prisma.stockItem.findMany({
        where: { companyId },
        select: {
          quantityOnHand: true,
          reorderPoint: true,
          product: { select: { unitPriceCents: true } },
        },
      }),
      this.prisma.stockMovement.groupBy({ by: ["type"], where: { companyId }, _count: { _all: true } }),
    ]);

    const totalUnitsOnHand = stockItems.reduce((sum, item) => sum + item.quantityOnHand, 0);
    const totalStockValueCents = stockItems.reduce(
      (sum, item) => sum + item.quantityOnHand * item.product.unitPriceCents,
      0,
    );
    const lowStockCount = stockItems.filter((item) => item.quantityOnHand <= item.reorderPoint).length;
    const totalMovementCount = grouped.reduce((sum, g) => sum + g._count._all, 0);

    return {
      warehouseCount,
      trackedItemCount: stockItems.length,
      totalUnitsOnHand,
      totalStockValueCents,
      lowStockCount,
      totalMovementCount,
    };
  }

  async movementsByType(companyId: string) {
    const grouped = await this.prisma.stockMovement.groupBy({
      by: ["type"],
      where: { companyId },
      _count: { _all: true },
    });
    const byType = new Map(grouped.map((g) => [g.type, g._count._all]));
    return { types: MOVEMENT_TYPES.map((type) => ({ type, count: byType.get(type) ?? 0 })) };
  }
}
