import { NotFoundException } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CreateAccountDto } from "./dto/create-account.dto";
import type { ListAccountsQueryDto } from "./dto/list-accounts-query.dto";
import type { UpdateAccountDto } from "./dto/update-account.dto";

const EXPORT_ROW_LIMIT = 5000;

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListAccountsQueryDto, "search" | "ownerId">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search
        ? { name: { contains: query.search, mode: "insensitive" as const } }
        : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
    };
  }

  async list(companyId: string, query: ListAccountsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.crmAccount.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { owner: { select: { id: true, firstName: true, lastName: true } }, _count: { select: { contacts: true, deals: true } } },
      }),
      this.prisma.crmAccount.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const account = await this.prisma.crmAccount.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        contacts: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
        deals: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!account) {
      throw new NotFoundException("Account not found");
    }
    return account;
  }

  create(companyId: string, dto: CreateAccountDto) {
    return this.prisma.crmAccount.create({ data: { companyId, ...dto } });
  }

  async update(companyId: string, id: string, dto: UpdateAccountDto) {
    await this.assertExists(companyId, id);
    return this.prisma.crmAccount.update({ where: { id }, data: dto });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.assertExists(companyId, id);
    await this.prisma.crmAccount.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(companyId: string, query: Pick<ListAccountsQueryDto, "search" | "ownerId">): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.crmAccount.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
      select: { id: true, name: true, industry: true, website: true, phone: true, createdAt: true },
    });
    return toCsv(rows, ["id", "name", "industry", "website", "phone", "createdAt"]);
  }

  private async assertExists(companyId: string, id: string): Promise<void> {
    const count = await this.prisma.crmAccount.count({ where: { id, companyId, deletedAt: null } });
    if (count === 0) {
      throw new NotFoundException("Account not found");
    }
  }
}
