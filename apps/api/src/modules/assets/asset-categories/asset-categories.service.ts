import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CreateAssetCategoryDto } from "./dto/create-asset-category.dto";
import type { ListAssetCategoriesQueryDto } from "./dto/list-asset-categories-query.dto";
import type { UpdateAssetCategoryDto } from "./dto/update-asset-category.dto";

const EXPORT_ROW_LIMIT = 5000;

const categoryInclude = {
  assetAccount: { select: { id: true, code: true, name: true } },
  depreciationExpenseAccount: { select: { id: true, code: true, name: true } },
  accumulatedDepreciationAccount: { select: { id: true, code: true, name: true } },
} as const;

const LEDGER_ACCOUNT_FIELDS = [
  "assetAccountId",
  "depreciationExpenseAccountId",
  "accumulatedDepreciationAccountId",
] as const;

@Injectable()
export class AssetCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListAssetCategoriesQueryDto, "search" | "isActive">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" as const } },
              { code: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };
  }

  private async assertLedgerAccountsBelong(
    companyId: string,
    dto: Pick<CreateAssetCategoryDto, (typeof LEDGER_ACCOUNT_FIELDS)[number]>,
  ) {
    const ids = LEDGER_ACCOUNT_FIELDS.map((field) => dto[field]).filter((id): id is string => !!id);
    if (ids.length === 0) {
      return;
    }
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { id: { in: ids }, companyId, deletedAt: null },
    });
    if (accounts.length !== new Set(ids).size) {
      throw new BadRequestException("One or more ledger accounts do not belong to this company");
    }
  }

  async list(companyId: string, query: ListAssetCategoriesQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.assetCategory.findMany({
        where,
        include: categoryInclude,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.assetCategory.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const category = await this.prisma.assetCategory.findFirst({
      where: { id, companyId, deletedAt: null },
      include: categoryInclude,
    });
    if (!category) {
      throw new NotFoundException("Asset category not found");
    }
    return category;
  }

  async create(companyId: string, dto: CreateAssetCategoryDto) {
    const existing = await this.prisma.assetCategory.findFirst({
      where: { companyId, code: dto.code, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException("An asset category with this code already exists");
    }
    await this.assertLedgerAccountsBelong(companyId, dto);
    return this.prisma.assetCategory.create({ data: { companyId, ...dto }, include: categoryInclude });
  }

  async update(companyId: string, id: string, dto: UpdateAssetCategoryDto) {
    await this.findOne(companyId, id);
    if (dto.code) {
      const existing = await this.prisma.assetCategory.findFirst({
        where: { companyId, code: dto.code, deletedAt: null, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException("An asset category with this code already exists");
      }
    }
    await this.assertLedgerAccountsBelong(companyId, dto);
    return this.prisma.assetCategory.update({ where: { id }, data: dto, include: categoryInclude });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.findOne(companyId, id);
    await this.prisma.assetCategory.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListAssetCategoriesQueryDto, "search" | "isActive">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.assetCategory.findMany({
      where,
      include: categoryInclude,
      orderBy: { name: "asc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      code: r.code,
      name: r.name,
      defaultUsefulLifeMonths: r.defaultUsefulLifeMonths,
      assetAccountCode: r.assetAccount?.code ?? "",
      depreciationExpenseAccountCode: r.depreciationExpenseAccount?.code ?? "",
      accumulatedDepreciationAccountCode: r.accumulatedDepreciationAccount?.code ?? "",
      isActive: r.isActive,
    }));
    return toCsv(flat, [
      "code",
      "name",
      "defaultUsefulLifeMonths",
      "assetAccountCode",
      "depreciationExpenseAccountCode",
      "accumulatedDepreciationAccountCode",
      "isActive",
    ]);
  }
}
