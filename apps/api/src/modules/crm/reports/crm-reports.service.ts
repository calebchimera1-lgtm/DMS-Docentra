import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

const DEAL_STAGES = ["PROSPECTING", "QUALIFICATION", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const;
const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"] as const;

@Injectable()
export class CrmReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async pipeline(companyId: string) {
    const grouped = await this.prisma.crmDeal.groupBy({
      by: ["stage"],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
      _sum: { valueCents: true },
    });

    const byStage = new Map(grouped.map((g) => [g.stage, g]));
    const stages = DEAL_STAGES.map((stage) => ({
      stage,
      count: byStage.get(stage)?._count._all ?? 0,
      totalValueCents: byStage.get(stage)?._sum.valueCents ?? 0,
    }));

    const openStages = stages.filter((s) => s.stage !== "WON" && s.stage !== "LOST");
    const won = stages.find((s) => s.stage === "WON");
    const lost = stages.find((s) => s.stage === "LOST");

    return {
      stages,
      openPipelineValueCents: openStages.reduce((sum, s) => sum + s.totalValueCents, 0),
      openDealCount: openStages.reduce((sum, s) => sum + s.count, 0),
      wonValueCents: won?.totalValueCents ?? 0,
      lostValueCents: lost?.totalValueCents ?? 0,
    };
  }

  async leadsFunnel(companyId: string) {
    const grouped = await this.prisma.crmLead.groupBy({
      by: ["status"],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
    });

    const byStatus = new Map(grouped.map((g) => [g.status, g._count._all]));
    return {
      statuses: LEAD_STATUSES.map((status) => ({ status, count: byStatus.get(status) ?? 0 })),
    };
  }

  async summary(companyId: string) {
    const [accountCount, contactCount, openLeadCount, pipeline] = await Promise.all([
      this.prisma.crmAccount.count({ where: { companyId, deletedAt: null } }),
      this.prisma.crmContact.count({ where: { companyId, deletedAt: null } }),
      this.prisma.crmLead.count({
        where: { companyId, deletedAt: null, status: { notIn: ["CONVERTED", "LOST"] } },
      }),
      this.pipeline(companyId),
    ]);

    return {
      accountCount,
      contactCount,
      openLeadCount,
      openDealCount: pipeline.openDealCount,
      openPipelineValueCents: pipeline.openPipelineValueCents,
      wonValueCents: pipeline.wonValueCents,
    };
  }
}
