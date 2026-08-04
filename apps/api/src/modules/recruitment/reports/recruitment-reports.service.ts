import { Injectable } from "@nestjs/common";
import type { ApplicationStatus } from "@omniflow/database";
import { PrismaService } from "../../../prisma/prisma.service";

const APPLICATION_STATUSES: ApplicationStatus[] = [
  "APPLIED",
  "SCREENING",
  "INTERVIEWING",
  "OFFERED",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
];
const ACTIVE_STATUSES: ApplicationStatus[] = ["APPLIED", "SCREENING", "INTERVIEWING", "OFFERED"];

@Injectable()
export class RecruitmentReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(companyId: string) {
    const [openPostingCount, activeApplicationCount, scheduledInterviewCount, hiredCount] = await Promise.all([
      this.prisma.jobPosting.count({ where: { companyId, deletedAt: null, status: "OPEN" } }),
      this.prisma.application.count({ where: { companyId, deletedAt: null, status: { in: ACTIVE_STATUSES } } }),
      this.prisma.interview.count({ where: { companyId, status: "SCHEDULED" } }),
      this.prisma.application.count({ where: { companyId, status: "HIRED" } }),
    ]);

    return { openPostingCount, activeApplicationCount, scheduledInterviewCount, hiredCount };
  }

  async applicationsByStatus(companyId: string) {
    const grouped = await this.prisma.application.groupBy({
      by: ["status"],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
    });
    const countByStatus = new Map(grouped.map((g) => [g.status, g._count._all]));
    return APPLICATION_STATUSES.map((status) => ({ status, count: countByStatus.get(status) ?? 0 }));
  }
}
