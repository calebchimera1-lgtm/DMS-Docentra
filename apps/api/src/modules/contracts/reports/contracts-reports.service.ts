import { Injectable } from "@nestjs/common";
import type { ContractStatus } from "@omniflow/database";
import { PrismaService } from "../../../prisma/prisma.service";

const CONTRACT_STATUSES: ContractStatus[] = ["DRAFT", "ACTIVE", "EXPIRED", "TERMINATED", "RENEWED"];
const EXPIRING_SOON_WINDOW_DAYS = 30;

@Injectable()
export class ContractsReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(companyId: string) {
    const now = new Date();
    const expiringSoonBy = new Date(now.getTime() + EXPIRING_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [draftCount, activeCount, expiringSoonCount, activeAgg] = await Promise.all([
      this.prisma.contract.count({ where: { companyId, deletedAt: null, status: "DRAFT" } }),
      this.prisma.contract.count({ where: { companyId, deletedAt: null, status: "ACTIVE" } }),
      this.prisma.contract.count({
        where: { companyId, deletedAt: null, status: "ACTIVE", endDate: { gte: now, lte: expiringSoonBy } },
      }),
      this.prisma.contract.aggregate({
        where: { companyId, deletedAt: null, status: "ACTIVE" },
        _sum: { valueCents: true },
      }),
    ]);

    return { draftCount, activeCount, expiringSoonCount, totalActiveValueCents: activeAgg._sum.valueCents ?? 0 };
  }

  async byStatus(companyId: string) {
    const grouped = await this.prisma.contract.groupBy({
      by: ["status"],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
    });
    const countByStatus = new Map(grouped.map((g) => [g.status, g._count._all]));
    return CONTRACT_STATUSES.map((status) => ({ status, count: countByStatus.get(status) ?? 0 }));
  }
}
