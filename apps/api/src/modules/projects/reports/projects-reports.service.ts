import { Injectable } from "@nestjs/common";
import type { TaskStatus } from "@omniflow/database";
import { PrismaService } from "../../../prisma/prisma.service";

const TASK_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

@Injectable()
export class ProjectsReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(companyId: string) {
    const [activeProjectCount, totalProjectCount, openTaskCount, overdueTaskCount, minutesAgg] = await Promise.all([
      this.prisma.project.count({ where: { companyId, deletedAt: null, status: "ACTIVE" } }),
      this.prisma.project.count({ where: { companyId, deletedAt: null } }),
      this.prisma.projectTask.count({ where: { companyId, deletedAt: null, status: { not: "DONE" } } }),
      this.prisma.projectTask.count({
        where: { companyId, deletedAt: null, status: { not: "DONE" }, dueDate: { lt: new Date() } },
      }),
      this.prisma.timeEntry.aggregate({ where: { companyId }, _sum: { minutes: true } }),
    ]);

    return {
      activeProjectCount,
      totalProjectCount,
      openTaskCount,
      overdueTaskCount,
      totalMinutesLogged: minutesAgg._sum.minutes ?? 0,
    };
  }

  async tasksByStatus(companyId: string) {
    const grouped = await this.prisma.projectTask.groupBy({
      by: ["status"],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
    });
    const countByStatus = new Map(grouped.map((g) => [g.status, g._count._all]));
    return TASK_STATUSES.map((status) => ({ status, count: countByStatus.get(status) ?? 0 }));
  }
}
