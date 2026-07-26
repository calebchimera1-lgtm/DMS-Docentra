import { Injectable } from "@nestjs/common";
import type { PayslipStatus } from "@omniflow/database";
import { PrismaService } from "../../../prisma/prisma.service";

const PAYSLIP_STATUSES: PayslipStatus[] = ["PENDING", "PAID"];

@Injectable()
export class PayrollReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(companyId: string) {
    const [eligibleEmployeeCount, draftPayRunCount, processedPayRunCount, netPayAgg] = await Promise.all([
      this.prisma.employee.count({
        where: { companyId, deletedAt: null, status: "ACTIVE", salaryCents: { not: null } },
      }),
      this.prisma.payRun.count({ where: { companyId, deletedAt: null, status: "DRAFT" } }),
      this.prisma.payRun.count({ where: { companyId, deletedAt: null, status: "PROCESSED" } }),
      this.prisma.payslip.aggregate({ where: { companyId, status: "PAID" }, _sum: { netPayCents: true } }),
    ]);

    return {
      eligibleEmployeeCount,
      draftPayRunCount,
      processedPayRunCount,
      totalNetPayPaidCents: netPayAgg._sum.netPayCents ?? 0,
    };
  }

  async payslipsByStatus(companyId: string) {
    const grouped = await this.prisma.payslip.groupBy({
      by: ["status"],
      where: { companyId },
      _count: { _all: true },
    });
    const countByStatus = new Map(grouped.map((g) => [g.status, g._count._all]));
    return PAYSLIP_STATUSES.map((status) => ({ status, count: countByStatus.get(status) ?? 0 }));
  }
}
