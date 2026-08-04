import { Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CreateDealDto } from "./dto/create-deal.dto";
import type { ListDealsQueryDto } from "./dto/list-deals-query.dto";
import type { UpdateDealDto } from "./dto/update-deal.dto";

const EXPORT_ROW_LIMIT = 5000;

@Injectable()
export class DealsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListDealsQueryDto, "search" | "stage" | "accountId" | "ownerId">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search ? { title: { contains: query.search, mode: "insensitive" as const } } : {}),
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
    };
  }

  async list(companyId: string, query: ListDealsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.crmDeal.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          account: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
          owner: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.crmDeal.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const deal = await this.prisma.crmDeal.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!deal) {
      throw new NotFoundException("Deal not found");
    }
    return deal;
  }

  create(companyId: string, dto: CreateDealDto) {
    const { expectedCloseDate, ...rest } = dto;
    return this.prisma.crmDeal.create({
      data: {
        companyId,
        ...rest,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined,
      },
    });
  }

  async update(companyId: string, id: string, dto: UpdateDealDto) {
    await this.assertExists(companyId, id);
    const { expectedCloseDate, ...rest } = dto;
    return this.prisma.crmDeal.update({
      where: { id },
      data: {
        ...rest,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : undefined,
      },
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.assertExists(companyId, id);
    await this.prisma.crmDeal.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListDealsQueryDto, "search" | "stage" | "accountId" | "ownerId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.crmDeal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
      select: {
        id: true,
        title: true,
        valueCents: true,
        currency: true,
        stage: true,
        expectedCloseDate: true,
        createdAt: true,
      },
    });
    return toCsv(rows, ["id", "title", "valueCents", "currency", "stage", "expectedCloseDate", "createdAt"]);
  }

  private async assertExists(companyId: string, id: string): Promise<void> {
    const count = await this.prisma.crmDeal.count({ where: { id, companyId, deletedAt: null } });
    if (count === 0) {
      throw new NotFoundException("Deal not found");
    }
  }
}
