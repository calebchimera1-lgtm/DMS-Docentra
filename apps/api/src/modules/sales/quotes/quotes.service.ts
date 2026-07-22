import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import { priceLineItems } from "../common/line-item.dto";
import { formatDocumentNumber } from "../common/document-number.util";
import type { CreateQuoteDto } from "./dto/create-quote.dto";
import type { ListQuotesQueryDto } from "./dto/list-quotes-query.dto";
import type { UpdateQuoteDto } from "./dto/update-quote.dto";

const EXPORT_ROW_LIMIT = 5000;

const quoteInclude = {
  account: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListQuotesQueryDto, "search" | "status" | "accountId">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search ? { quoteNumber: { contains: query.search, mode: "insensitive" as const } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
    };
  }

  async list(companyId: string, query: ListQuotesQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.quote.findMany({
        where,
        include: quoteInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.quote.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { ...quoteInclude, salesOrder: { select: { id: true, orderNumber: true } } },
    });
    if (!quote) {
      throw new NotFoundException("Quote not found");
    }
    return quote;
  }

  async create(companyId: string, dto: CreateQuoteDto) {
    await this.assertAccountBelongsToCompany(companyId, dto.accountId);
    const { items, subtotalCents } = priceLineItems(dto.items);
    const discountCents = dto.discountCents ?? 0;
    const taxCents = dto.taxCents ?? 0;
    const totalCents = Math.max(0, subtotalCents - discountCents + taxCents);

    const count = await this.prisma.quote.count({ where: { companyId } });
    return this.prisma.quote.create({
      data: {
        companyId,
        accountId: dto.accountId,
        contactId: dto.contactId,
        quoteNumber: formatDocumentNumber("Q", count),
        items: items as unknown as object,
        subtotalCents,
        discountCents,
        taxCents,
        totalCents,
        currency: dto.currency ?? "USD",
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      },
      include: quoteInclude,
    });
  }

  async update(companyId: string, id: string, dto: UpdateQuoteDto) {
    const existing = await this.findOne(companyId, id);
    if (dto.accountId) {
      await this.assertAccountBelongsToCompany(companyId, dto.accountId);
    }

    const items = dto.items ? priceLineItems(dto.items) : null;
    const discountCents = dto.discountCents ?? existing.discountCents;
    const taxCents = dto.taxCents ?? existing.taxCents;
    const subtotalCents = items?.subtotalCents ?? existing.subtotalCents;
    const totalCents = Math.max(0, subtotalCents - discountCents + taxCents);

    return this.prisma.quote.update({
      where: { id },
      data: {
        accountId: dto.accountId,
        contactId: dto.contactId,
        items: items?.items as unknown as object | undefined,
        subtotalCents,
        discountCents,
        taxCents,
        totalCents,
        currency: dto.currency,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        status: dto.status,
      },
      include: quoteInclude,
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.findOne(companyId, id);
    await this.prisma.quote.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async convertToOrder(companyId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { salesOrder: true },
    });
    if (!quote) {
      throw new NotFoundException("Quote not found");
    }
    if (quote.salesOrder) {
      throw new BadRequestException("This quote has already been converted to a sales order");
    }
    if (quote.status !== "ACCEPTED") {
      throw new BadRequestException("Only an accepted quote can be converted to a sales order");
    }

    const count = await this.prisma.salesOrder.count({ where: { companyId } });
    return this.prisma.salesOrder.create({
      data: {
        companyId,
        accountId: quote.accountId,
        contactId: quote.contactId,
        quoteId: quote.id,
        orderNumber: formatDocumentNumber("SO", count),
        items: quote.items as object,
        totalCents: quote.totalCents,
        currency: quote.currency,
      },
    });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListQuotesQueryDto, "search" | "status" | "accountId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.quote.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
      select: { id: true, quoteNumber: true, status: true, totalCents: true, currency: true, createdAt: true },
    });
    return toCsv(rows, ["id", "quoteNumber", "status", "totalCents", "currency", "createdAt"]);
  }

  private async assertAccountBelongsToCompany(companyId: string, accountId: string): Promise<void> {
    const count = await this.prisma.crmAccount.count({ where: { id: accountId, companyId, deletedAt: null } });
    if (count === 0) {
      throw new BadRequestException("Account does not belong to this company");
    }
  }
}
