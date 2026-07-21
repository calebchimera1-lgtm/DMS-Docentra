import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

interface CompanyDashboardStatsRow {
  company_id: string;
  company_name: string;
  branch_count: bigint;
  active_user_count: bigint;
  total_user_count: bigint;
  unread_notification_count: bigint;
}

export interface DashboardSummary {
  branchCount: number;
  activeUserCount: number;
  totalUserCount: number;
  unreadNotificationCount: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Backed by the `company_dashboard_stats` view (see
   * packages/database/prisma/migrations/.../core_views_triggers_procedures)
   * rather than re-deriving the same aggregation with Prisma — the view is
   * the single source of truth for these counts.
   */
  async getSummary(companyId: string): Promise<DashboardSummary> {
    const rows = await this.prisma.$queryRaw<CompanyDashboardStatsRow[]>`
      SELECT * FROM company_dashboard_stats WHERE company_id::text = ${companyId}
    `;
    const row = rows[0];

    if (!row) {
      return { branchCount: 0, activeUserCount: 0, totalUserCount: 0, unreadNotificationCount: 0 };
    }

    return {
      branchCount: Number(row.branch_count),
      activeUserCount: Number(row.active_user_count),
      totalUserCount: Number(row.total_user_count),
      unreadNotificationCount: Number(row.unread_notification_count),
    };
  }

  async getActivityByAction(companyId: string, sinceDays = 30) {
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    const grouped = await this.prisma.auditLog.groupBy({
      by: ["action"],
      where: { companyId, createdAt: { gte: since } },
      _count: { _all: true },
    });
    return grouped
      .map((row) => ({ action: row.action, count: row._count._all }))
      .sort((a, b) => b.count - a.count);
  }

  async getRecentActivity(companyId: string, limit = 20) {
    return this.prisma.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
