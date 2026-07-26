import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CreateExpenseCategoryDto } from "./dto/create-expense-category.dto";
import type { ListExpenseCategoriesQueryDto } from "./dto/list-expense-categories-query.dto";
import type { UpdateExpenseCategoryDto } from "./dto/update-expense-category.dto";

const EXPORT_ROW_LIMIT = 5000;

const categoryInclude = {
  ledgerAccount: { select: { id: true, code: true, name: true } },
} as const;

@Injectable()
export class ExpenseCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListExpenseCategoriesQueryDto, "search" | "isActive">) {
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

  private async assertLedgerAccountBelongs(companyId: string, ledgerAccountId: string) {
    const account = await this.prisma.ledgerAccount.findFirst({
      where: { id: ledgerAccountId, companyId, deletedAt: null },
    });
    if (!account) {
      throw new BadRequestException("Ledger account does not belong to this company");
    }
  }

  async list(companyId: string, query: ListExpenseCategoriesQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.expenseCategory.findMany({
        where,
        include: categoryInclude,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.expenseCategory.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const category = await this.prisma.expenseCategory.findFirst({
      where: { id, companyId, deletedAt: null },
      include: categoryInclude,
    });
    if (!category) {
      throw new NotFoundException("Expense category not found");
    }
    return category;
  }

  async create(companyId: string, dto: CreateExpenseCategoryDto) {
    const existing = await this.prisma.expenseCategory.findFirst({
      where: { companyId, code: dto.code, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException("An expense category with this code already exists");
    }
    if (dto.ledgerAccountId) {
      await this.assertLedgerAccountBelongs(companyId, dto.ledgerAccountId);
    }
    return this.prisma.expenseCategory.create({ data: { companyId, ...dto }, include: categoryInclude });
  }

  async update(companyId: string, id: string, dto: UpdateExpenseCategoryDto) {
    await this.findOne(companyId, id);
    if (dto.code) {
      const existing = await this.prisma.expenseCategory.findFirst({
        where: { companyId, code: dto.code, deletedAt: null, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException("An expense category with this code already exists");
      }
    }
    if (dto.ledgerAccountId) {
      await this.assertLedgerAccountBelongs(companyId, dto.ledgerAccountId);
    }
    return this.prisma.expenseCategory.update({ where: { id }, data: dto, include: categoryInclude });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.findOne(companyId, id);
    await this.prisma.expenseCategory.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListExpenseCategoriesQueryDto, "search" | "isActive">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.expenseCategory.findMany({
      where,
      include: categoryInclude,
      orderBy: { name: "asc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      code: r.code,
      name: r.name,
      ledgerAccountCode: r.ledgerAccount?.code ?? "",
      isActive: r.isActive,
    }));
    return toCsv(flat, ["code", "name", "ledgerAccountCode", "isActive"]);
  }
}
