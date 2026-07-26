import { Injectable } from "@nestjs/common";
import type { WorkOrderStatus } from "@omniflow/database";
import { PrismaService } from "../../../prisma/prisma.service";

const WORK_ORDER_STATUSES: WorkOrderStatus[] = ["DRAFT", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

@Injectable()
export class ManufacturingReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(companyId: string) {
    const [draftCount, inProgressCount, completedCount, activeBomCount, completedAgg] = await Promise.all([
      this.prisma.workOrder.count({ where: { companyId, deletedAt: null, status: "DRAFT" } }),
      this.prisma.workOrder.count({ where: { companyId, deletedAt: null, status: "IN_PROGRESS" } }),
      this.prisma.workOrder.count({ where: { companyId, deletedAt: null, status: "COMPLETED" } }),
      this.prisma.billOfMaterial.count({ where: { companyId, deletedAt: null, isActive: true } }),
      this.prisma.workOrder.aggregate({
        where: { companyId, deletedAt: null, status: "COMPLETED" },
        _sum: { quantity: true },
      }),
    ]);

    return {
      draftCount,
      inProgressCount,
      completedCount,
      activeBomCount,
      totalCompletedQuantity: completedAgg._sum.quantity ?? 0,
    };
  }

  async byStatus(companyId: string) {
    const grouped = await this.prisma.workOrder.groupBy({
      by: ["status"],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
    });
    const countByStatus = new Map(grouped.map((g) => [g.status, g._count._all]));
    return WORK_ORDER_STATUSES.map((status) => ({ status, count: countByStatus.get(status) ?? 0 }));
  }
}
