import { Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { ListDepreciationLinesQueryDto } from "./dto/list-depreciation-lines-query.dto";

const EXPORT_ROW_LIMIT = 5000;

const lineInclude = {
  asset: { select: { id: true, assetNumber: true, name: true } },
  depreciationRun: { select: { id: true, periodDate: true, status: true } },
} as const;

@Injectable()
export class DepreciationLinesService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(
    companyId: string,
    query: Pick<ListDepreciationLinesQueryDto, "depreciationRunId" | "assetId">,
  ) {
    return {
      companyId,
      ...(query.depreciationRunId ? { depreciationRunId: query.depreciationRunId } : {}),
      ...(query.assetId ? { assetId: query.assetId } : {}),
    };
  }

  async list(companyId: string, query: ListDepreciationLinesQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.depreciationLine.findMany({
        where,
        include: lineInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.depreciationLine.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const line = await this.prisma.depreciationLine.findFirst({
      where: { id, companyId },
      include: lineInclude,
    });
    if (!line) {
      throw new NotFoundException("Depreciation line not found");
    }
    return line;
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListDepreciationLinesQueryDto, "depreciationRunId" | "assetId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.depreciationLine.findMany({
      where,
      include: lineInclude,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      assetNumber: r.asset.assetNumber,
      assetName: r.asset.name,
      periodDate: r.depreciationRun.periodDate,
      amountCents: r.amountCents,
      accumulatedAfterCents: r.accumulatedAfterCents,
    }));
    return toCsv(flat, ["assetNumber", "assetName", "periodDate", "amountCents", "accumulatedAfterCents"]);
  }
}
