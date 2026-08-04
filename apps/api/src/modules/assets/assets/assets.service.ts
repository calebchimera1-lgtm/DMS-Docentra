import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import { formatDocumentNumber } from "../../sales/common/document-number.util";
import type { CreateAssetDto } from "./dto/create-asset.dto";
import type { DisposeAssetDto } from "./dto/dispose-asset.dto";
import type { ListAssetsQueryDto } from "./dto/list-assets-query.dto";
import type { UpdateAssetDto } from "./dto/update-asset.dto";

const EXPORT_ROW_LIMIT = 5000;

const assetInclude = {
  category: { select: { id: true, name: true, code: true } },
  disposalJournalEntry: { select: { id: true, entryNumber: true } },
} as const;

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListAssetsQueryDto, "search" | "status" | "categoryId">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" as const } },
              { assetNumber: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    };
  }

  async list(companyId: string, query: ListAssetsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        include: assetInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.asset.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, companyId, deletedAt: null },
      include: assetInclude,
    });
    if (!asset) {
      throw new NotFoundException("Asset not found");
    }
    return asset;
  }

  async create(companyId: string, dto: CreateAssetDto) {
    const category = await this.prisma.assetCategory.findFirst({
      where: { id: dto.categoryId, companyId, deletedAt: null },
    });
    if (!category) {
      throw new BadRequestException("Asset category does not belong to this company");
    }

    const count = await this.prisma.asset.count({ where: { companyId } });

    return this.prisma.asset.create({
      data: {
        companyId,
        categoryId: dto.categoryId,
        assetNumber: formatDocumentNumber("AST", count),
        name: dto.name,
        purchaseDate: new Date(dto.purchaseDate),
        purchaseCostCents: dto.purchaseCostCents,
        salvageValueCents: dto.salvageValueCents ?? 0,
        usefulLifeMonths: dto.usefulLifeMonths ?? category.defaultUsefulLifeMonths,
        note: dto.note,
      },
      include: assetInclude,
    });
  }

  async update(companyId: string, id: string, dto: UpdateAssetDto) {
    const existing = await this.findOne(companyId, id);
    if (existing.status !== "ACTIVE") {
      throw new BadRequestException("Only an active asset can be edited");
    }
    if (dto.categoryId) {
      const category = await this.prisma.assetCategory.findFirst({
        where: { id: dto.categoryId, companyId, deletedAt: null },
      });
      if (!category) {
        throw new BadRequestException("Asset category does not belong to this company");
      }
    }
    return this.prisma.asset.update({ where: { id }, data: dto, include: assetInclude });
  }

  async remove(companyId: string, id: string): Promise<void> {
    const existing = await this.findOne(companyId, id);
    if (existing.status !== "ACTIVE" || existing.accumulatedDepreciationCents > 0) {
      throw new ForbiddenException("Only an active asset with no depreciation history can be deleted");
    }
    await this.prisma.asset.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /**
   * Writes off an asset: debits accumulated depreciation (removing the
   * contra-asset balance), debits any cash proceeds, credits the asset
   * account for its original cost, and posts the resulting gain or loss —
   * the same "dedicated action with a real accounting side effect"
   * precedent as Expenses' approve(). The four lines balance by
   * construction: debits (accumDep + proceeds [+ loss]) always equal
   * credits (cost [+ gain]), since gain/loss = proceeds - (cost - accumDep).
   */
  async dispose(companyId: string, id: string, dto: DisposeAssetDto) {
    const asset = await this.findOne(companyId, id);
    if (asset.status !== "ACTIVE") {
      throw new BadRequestException("Only an active asset can be disposed");
    }

    const proceedsCents = dto.disposalProceedsCents ?? 0;
    if (proceedsCents > 0 && !dto.cashAccountId) {
      throw new BadRequestException("cashAccountId is required when disposalProceedsCents is greater than 0");
    }

    const category = await this.prisma.assetCategory.findFirst({ where: { id: asset.categoryId, companyId } });
    if (!category?.assetAccountId || !category.accumulatedDepreciationAccountId) {
      throw new BadRequestException(
        `Asset category "${category?.name ?? asset.categoryId}" is missing its asset or accumulated depreciation account — set both before disposing`,
      );
    }

    const [cashAccount, gainLossAccount] = await Promise.all([
      dto.cashAccountId
        ? this.prisma.ledgerAccount.findFirst({ where: { id: dto.cashAccountId, companyId, deletedAt: null } })
        : Promise.resolve(null),
      this.prisma.ledgerAccount.findFirst({ where: { id: dto.gainLossAccountId, companyId, deletedAt: null } }),
    ]);
    if (dto.cashAccountId && !cashAccount) {
      throw new BadRequestException("Cash account does not belong to this company");
    }
    if (!gainLossAccount) {
      throw new BadRequestException("Gain/loss account does not belong to this company");
    }

    const netBookValueCents = asset.purchaseCostCents - asset.accumulatedDepreciationCents;
    const gainLossCents = proceedsCents - netBookValueCents;

    const lines: { ledgerAccountId: string; debitCents: number; creditCents: number; description: string }[] = [];
    if (asset.accumulatedDepreciationCents > 0) {
      lines.push({
        ledgerAccountId: category.accumulatedDepreciationAccountId,
        debitCents: asset.accumulatedDepreciationCents,
        creditCents: 0,
        description: `${asset.assetNumber}: remove accumulated depreciation`,
      });
    }
    if (proceedsCents > 0 && dto.cashAccountId) {
      lines.push({
        ledgerAccountId: dto.cashAccountId,
        debitCents: proceedsCents,
        creditCents: 0,
        description: `${asset.assetNumber}: disposal proceeds`,
      });
    }
    lines.push({
      ledgerAccountId: category.assetAccountId,
      debitCents: 0,
      creditCents: asset.purchaseCostCents,
      description: `${asset.assetNumber}: remove asset cost`,
    });
    if (gainLossCents > 0) {
      lines.push({
        ledgerAccountId: dto.gainLossAccountId,
        debitCents: 0,
        creditCents: gainLossCents,
        description: `${asset.assetNumber}: gain on disposal`,
      });
    } else if (gainLossCents < 0) {
      lines.push({
        ledgerAccountId: dto.gainLossAccountId,
        debitCents: -gainLossCents,
        creditCents: 0,
        description: `${asset.assetNumber}: loss on disposal`,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const journalEntryCount = await tx.journalEntry.count({ where: { companyId } });
      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          entryNumber: formatDocumentNumber("JE", journalEntryCount),
          entryDate: new Date(dto.disposalDate),
          memo: `Disposal of asset ${asset.assetNumber}`,
          status: "POSTED",
          lines: { create: lines.map((line, lineOrder) => ({ ...line, lineOrder })) },
        },
      });

      return tx.asset.update({
        where: { id: asset.id },
        data: {
          status: "DISPOSED",
          disposalDate: new Date(dto.disposalDate),
          disposalProceedsCents: proceedsCents,
          disposalJournalEntryId: journalEntry.id,
        },
        include: assetInclude,
      });
    });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListAssetsQueryDto, "search" | "status" | "categoryId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.asset.findMany({
      where,
      include: assetInclude,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      assetNumber: r.assetNumber,
      name: r.name,
      categoryName: r.category.name,
      purchaseDate: r.purchaseDate,
      purchaseCostCents: r.purchaseCostCents,
      accumulatedDepreciationCents: r.accumulatedDepreciationCents,
      netBookValueCents: r.purchaseCostCents - r.accumulatedDepreciationCents,
      status: r.status,
    }));
    return toCsv(flat, [
      "assetNumber",
      "name",
      "categoryName",
      "purchaseDate",
      "purchaseCostCents",
      "accumulatedDepreciationCents",
      "netBookValueCents",
      "status",
    ]);
  }
}
