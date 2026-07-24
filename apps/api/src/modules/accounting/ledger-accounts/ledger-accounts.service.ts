import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CreateLedgerAccountDto } from "./dto/create-ledger-account.dto";
import type { ListLedgerAccountsQueryDto } from "./dto/list-ledger-accounts-query.dto";
import type { UpdateLedgerAccountDto } from "./dto/update-ledger-account.dto";

const EXPORT_ROW_LIMIT = 5000;

@Injectable()
export class LedgerAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListLedgerAccountsQueryDto, "search" | "type" | "isActive">) {
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
      ...(query.type ? { type: query.type } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };
  }

  async list(companyId: string, query: ListLedgerAccountsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.ledgerAccount.findMany({
        where,
        orderBy: { code: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.ledgerAccount.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const account = await this.prisma.ledgerAccount.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!account) {
      throw new NotFoundException("Ledger account not found");
    }
    return account;
  }

  async create(companyId: string, dto: CreateLedgerAccountDto) {
    const existing = await this.prisma.ledgerAccount.findFirst({
      where: { companyId, code: dto.code, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException("A ledger account with this code already exists");
    }
    return this.prisma.ledgerAccount.create({ data: { companyId, ...dto } });
  }

  async update(companyId: string, id: string, dto: UpdateLedgerAccountDto) {
    await this.findOne(companyId, id);
    if (dto.code) {
      const existing = await this.prisma.ledgerAccount.findFirst({
        where: { companyId, code: dto.code, deletedAt: null, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException("A ledger account with this code already exists");
      }
    }
    return this.prisma.ledgerAccount.update({ where: { id }, data: dto });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.findOne(companyId, id);
    const lineCount = await this.prisma.journalLine.count({ where: { ledgerAccountId: id } });
    if (lineCount > 0) {
      throw new ForbiddenException("Cannot delete a ledger account that has journal activity");
    }
    await this.prisma.ledgerAccount.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListLedgerAccountsQueryDto, "search" | "type" | "isActive">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.ledgerAccount.findMany({
      where,
      orderBy: { code: "asc" },
      take: EXPORT_ROW_LIMIT,
      select: { id: true, code: true, name: true, type: true, isActive: true },
    });
    return toCsv(rows, ["id", "code", "name", "type", "isActive"]);
  }
}
