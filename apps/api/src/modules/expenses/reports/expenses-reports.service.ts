import { Injectable } from "@nestjs/common";
import type { ExpenseClaimStatus } from "@omniflow/database";
import { PrismaService } from "../../../prisma/prisma.service";
import type { SnapshottedExpenseLine } from "../common/expense-line.dto";

const CLAIM_STATUSES: ExpenseClaimStatus[] = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "PAID", "CANCELLED"];

@Injectable()
export class ExpensesReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(companyId: string) {
    const [draftClaimCount, submittedClaimCount, approvedUnpaidClaimCount, paidAgg] = await Promise.all([
      this.prisma.expenseClaim.count({ where: { companyId, deletedAt: null, status: "DRAFT" } }),
      this.prisma.expenseClaim.count({ where: { companyId, deletedAt: null, status: "SUBMITTED" } }),
      this.prisma.expenseClaim.count({ where: { companyId, deletedAt: null, status: "APPROVED" } }),
      this.prisma.expenseClaim.aggregate({ where: { companyId, status: "PAID" }, _sum: { totalCents: true } }),
    ]);

    return {
      draftClaimCount,
      submittedClaimCount,
      approvedUnpaidClaimCount,
      totalPaidCents: paidAgg._sum.totalCents ?? 0,
    };
  }

  async claimsByStatus(companyId: string) {
    const grouped = await this.prisma.expenseClaim.groupBy({
      by: ["status"],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
    });
    const countByStatus = new Map(grouped.map((g) => [g.status, g._count._all]));
    return CLAIM_STATUSES.map((status) => ({ status, count: countByStatus.get(status) ?? 0 }));
  }

  /**
   * Categories live inside each claim's JSON line-item snapshot, not a
   * relational join table, so the breakdown is aggregated in application
   * code over approved/paid claims rather than a SQL groupBy.
   */
  async spendByCategory(companyId: string) {
    const claims = await this.prisma.expenseClaim.findMany({
      where: { companyId, status: { in: ["APPROVED", "PAID"] } },
      select: { items: true },
    });

    const totals = new Map<string, number>();
    for (const claim of claims) {
      const lines = claim.items as unknown as SnapshottedExpenseLine[];
      for (const line of lines) {
        totals.set(line.categoryName, (totals.get(line.categoryName) ?? 0) + line.amountCents);
      }
    }

    return [...totals.entries()]
      .map(([categoryName, totalCents]) => ({ categoryName, totalCents }))
      .sort((a, b) => b.totalCents - a.totalCents);
  }
}
