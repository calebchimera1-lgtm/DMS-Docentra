import { Injectable } from "@nestjs/common";
import type { PurchaseOrderStatus } from "@omniflow/database";
import { PrismaService } from "../../../prisma/prisma.service";

const STATUSES: PurchaseOrderStatus[] = ["DRAFT", "SENT", "CONFIRMED", "RECEIVED", "CANCELLED"];
const OPEN_STATUSES: PurchaseOrderStatus[] = ["DRAFT", "SENT", "CONFIRMED"];

@Injectable()
export class PurchaseReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(companyId: string) {
    const [supplierCount, openOrderCount, committedAgg, receivedOrderCount] = await Promise.all([
      this.prisma.supplier.count({ where: { companyId, deletedAt: null, isActive: true } }),
      this.prisma.purchaseOrder.count({ where: { companyId, deletedAt: null, status: { in: OPEN_STATUSES } } }),
      this.prisma.purchaseOrder.aggregate({
        where: { companyId, deletedAt: null, status: "CONFIRMED" },
        _sum: { totalCents: true },
      }),
      this.prisma.purchaseOrder.count({ where: { companyId, deletedAt: null, status: "RECEIVED" } }),
    ]);

    return {
      supplierCount,
      openOrderCount,
      committedSpendCents: committedAgg._sum.totalCents ?? 0,
      receivedOrderCount,
    };
  }

  async ordersByStatus(companyId: string) {
    const grouped = await this.prisma.purchaseOrder.groupBy({
      by: ["status"],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
    });
    const countByStatus = new Map(grouped.map((g) => [g.status, g._count._all]));
    return STATUSES.map((status) => ({ status, count: countByStatus.get(status) ?? 0 }));
  }
}
