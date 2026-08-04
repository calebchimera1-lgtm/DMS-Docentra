import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import { formatDocumentNumber } from "../../sales/common/document-number.util";
import type { CreateDepreciationRunDto } from "./dto/create-depreciation-run.dto";
import type { ListDepreciationRunsQueryDto } from "./dto/list-depreciation-runs-query.dto";
import type { UpdateDepreciationRunDto } from "./dto/update-depreciation-run.dto";

const EXPORT_ROW_LIMIT = 5000;
const runInclude = {
  journalEntry: { select: { id: true, entryNumber: true } },
  _count: { select: { lines: true } },
} as const;

interface CategoryBucket {
  expenseAccountId: string;
  accumAccountId: string;
  amountCents: number;
}

@Injectable()
export class DepreciationRunsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, query: ListDepreciationRunsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = { companyId, deletedAt: null, ...(query.status ? { status: query.status } : {}) };

    const [items, total] = await Promise.all([
      this.prisma.depreciationRun.findMany({
        where,
        include: runInclude,
        orderBy: { periodDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.depreciationRun.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const run = await this.prisma.depreciationRun.findFirst({
      where: { id, companyId, deletedAt: null },
      include: runInclude,
    });
    if (!run) {
      throw new NotFoundException("Depreciation run not found");
    }
    return run;
  }

  async create(companyId: string, userId: string, dto: CreateDepreciationRunDto) {
    return this.prisma.depreciationRun.create({
      data: { companyId, createdById: userId, periodDate: new Date(dto.periodDate) },
      include: runInclude,
    });
  }

  async update(companyId: string, id: string, dto: UpdateDepreciationRunDto) {
    const existing = await this.findOne(companyId, id);
    if (existing.status !== "DRAFT") {
      throw new BadRequestException("Only a draft depreciation run can be edited");
    }
    return this.prisma.depreciationRun.update({
      where: { id },
      data: { periodDate: dto.periodDate ? new Date(dto.periodDate) : undefined },
      include: runInclude,
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    const existing = await this.findOne(companyId, id);
    if (existing.status !== "DRAFT") {
      throw new ForbiddenException("Only a draft depreciation run can be deleted");
    }
    await this.prisma.depreciationRun.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /**
   * Posts one period of straight-line depreciation for every ACTIVE asset
   * with remaining depreciable value, grouping the amounts by category into
   * one debit (expense) / credit (accumulated depreciation) line pair per
   * category — the same "group line items by category into balanced
   * journal lines" idiom Expenses' approve() established. A real side
   * effect, so it's a dedicated action, not a plain status update.
   */
  async generate(companyId: string, id: string) {
    const run = await this.findOne(companyId, id);
    if (run.status !== "DRAFT") {
      throw new BadRequestException("Only a draft depreciation run can be generated");
    }

    const assets = await this.prisma.asset.findMany({
      where: { companyId, deletedAt: null, status: "ACTIVE" },
      include: { category: true },
    });

    const perAssetAmountCents = new Map<string, number>();
    const categoryTotals = new Map<string, CategoryBucket>();

    for (const asset of assets) {
      const depreciableBaseCents = asset.purchaseCostCents - asset.salvageValueCents;
      const remainingCents = depreciableBaseCents - asset.accumulatedDepreciationCents;
      if (remainingCents <= 0) {
        continue;
      }
      if (!asset.category.depreciationExpenseAccountId || !asset.category.accumulatedDepreciationAccountId) {
        throw new BadRequestException(
          `Asset category "${asset.category.name}" is missing its depreciation expense or accumulated depreciation account — set both before generating`,
        );
      }
      const monthlyDepreciationCents = Math.floor(depreciableBaseCents / asset.usefulLifeMonths);
      const amountCents = Math.min(monthlyDepreciationCents, remainingCents);
      if (amountCents <= 0) {
        continue;
      }
      perAssetAmountCents.set(asset.id, amountCents);
      const bucket = categoryTotals.get(asset.categoryId) ?? {
        expenseAccountId: asset.category.depreciationExpenseAccountId,
        accumAccountId: asset.category.accumulatedDepreciationAccountId,
        amountCents: 0,
      };
      bucket.amountCents += amountCents;
      categoryTotals.set(asset.categoryId, bucket);
    }

    if (perAssetAmountCents.size === 0) {
      throw new BadRequestException("No assets have remaining depreciable value to post for this run");
    }

    return this.prisma.$transaction(async (tx) => {
      let lineOrder = 0;
      const journalLines: {
        ledgerAccountId: string;
        debitCents: number;
        creditCents: number;
        description: string;
        lineOrder: number;
      }[] = [];
      for (const bucket of categoryTotals.values()) {
        journalLines.push({
          ledgerAccountId: bucket.expenseAccountId,
          debitCents: bucket.amountCents,
          creditCents: 0,
          description: "Depreciation expense",
          lineOrder: lineOrder++,
        });
        journalLines.push({
          ledgerAccountId: bucket.accumAccountId,
          debitCents: 0,
          creditCents: bucket.amountCents,
          description: "Accumulated depreciation",
          lineOrder: lineOrder++,
        });
      }

      const journalEntryCount = await tx.journalEntry.count({ where: { companyId } });
      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          entryNumber: formatDocumentNumber("JE", journalEntryCount),
          entryDate: run.periodDate,
          memo: `Depreciation run for ${run.periodDate.toISOString().slice(0, 10)}`,
          status: "POSTED",
          lines: { create: journalLines },
        },
      });

      for (const [assetId, amountCents] of perAssetAmountCents) {
        const asset = assets.find((a) => a.id === assetId)!;
        const accumulatedAfterCents = asset.accumulatedDepreciationCents + amountCents;
        await tx.depreciationLine.create({
          data: { companyId, depreciationRunId: run.id, assetId, amountCents, accumulatedAfterCents },
        });
        await tx.asset.update({ where: { id: assetId }, data: { accumulatedDepreciationCents: accumulatedAfterCents } });
      }

      return tx.depreciationRun.update({
        where: { id: run.id },
        data: { status: "POSTED", journalEntryId: journalEntry.id },
        include: runInclude,
      });
    });
  }

  async cancel(companyId: string, id: string) {
    const run = await this.findOne(companyId, id);
    if (run.status !== "DRAFT") {
      throw new BadRequestException("Only a draft depreciation run can be cancelled");
    }
    return this.prisma.depreciationRun.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: runInclude,
    });
  }

  async exportCsv(companyId: string, query: Pick<ListDepreciationRunsQueryDto, "status">): Promise<string> {
    const where = { companyId, deletedAt: null, ...(query.status ? { status: query.status } : {}) };
    const rows = await this.prisma.depreciationRun.findMany({
      where,
      include: runInclude,
      orderBy: { periodDate: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      periodDate: r.periodDate,
      status: r.status,
      lineCount: r._count.lines,
      journalEntryNumber: r.journalEntry?.entryNumber ?? "",
    }));
    return toCsv(flat, ["periodDate", "status", "lineCount", "journalEntryNumber"]);
  }
}
