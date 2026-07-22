import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import { priceLineItems } from "../common/line-item.dto";
import { formatDocumentNumber } from "../common/document-number.util";
import type { CreateSalesOrderDto } from "./dto/create-order.dto";
import type { ListOrdersQueryDto } from "./dto/list-orders-query.dto";
import type { UpdateSalesOrderDto } from "./dto/update-order.dto";

const EXPORT_ROW_LIMIT = 5000;
const DEFAULT_INVOICE_TERMS_DAYS = 30;

const orderInclude = {
  account: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  quote: { select: { id: true, quoteNumber: true } },
} as const;

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListOrdersQueryDto, "search" | "status" | "accountId">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search ? { orderNumber: { contains: query.search, mode: "insensitive" as const } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
    };
  }

  async list(companyId: string, query: ListOrdersQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.salesOrder.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { ...orderInclude, invoice: { select: { id: true, invoiceNumber: true } } },
    });
    if (!order) {
      throw new NotFoundException("Sales order not found");
    }
    return order;
  }

  async create(companyId: string, dto: CreateSalesOrderDto) {
    await this.assertAccountBelongsToCompany(companyId, dto.accountId);
    const { items, subtotalCents } = priceLineItems(dto.items);

    const count = await this.prisma.salesOrder.count({ where: { companyId } });
    return this.prisma.salesOrder.create({
      data: {
        companyId,
        accountId: dto.accountId,
        contactId: dto.contactId,
        orderNumber: formatDocumentNumber("SO", count),
        items: items as unknown as object,
        totalCents: subtotalCents,
        currency: dto.currency ?? "USD",
      },
      include: orderInclude,
    });
  }

  async update(companyId: string, id: string, dto: UpdateSalesOrderDto) {
    await this.findOne(companyId, id);
    if (dto.accountId) {
      await this.assertAccountBelongsToCompany(companyId, dto.accountId);
    }
    const priced = dto.items ? priceLineItems(dto.items) : null;

    return this.prisma.salesOrder.update({
      where: { id },
      data: {
        accountId: dto.accountId,
        contactId: dto.contactId,
        items: priced?.items as unknown as object | undefined,
        totalCents: priced?.subtotalCents,
        currency: dto.currency,
        status: dto.status,
      },
      include: orderInclude,
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.findOne(companyId, id);
    await this.prisma.salesOrder.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async convertToInvoice(companyId: string, id: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { invoice: true },
    });
    if (!order) {
      throw new NotFoundException("Sales order not found");
    }
    if (order.invoice) {
      throw new BadRequestException("This sales order has already been invoiced");
    }

    const count = await this.prisma.invoice.count({ where: { companyId } });
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + DEFAULT_INVOICE_TERMS_DAYS);

    return this.prisma.invoice.create({
      data: {
        companyId,
        accountId: order.accountId,
        contactId: order.contactId,
        salesOrderId: order.id,
        invoiceNumber: formatDocumentNumber("INV", count),
        items: order.items as object,
        totalCents: order.totalCents,
        currency: order.currency,
        dueDate,
      },
    });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListOrdersQueryDto, "search" | "status" | "accountId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.salesOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
      select: { id: true, orderNumber: true, status: true, totalCents: true, currency: true, createdAt: true },
    });
    return toCsv(rows, ["id", "orderNumber", "status", "totalCents", "currency", "createdAt"]);
  }

  private async assertAccountBelongsToCompany(companyId: string, accountId: string): Promise<void> {
    const count = await this.prisma.crmAccount.count({ where: { id: accountId, companyId, deletedAt: null } });
    if (count === 0) {
      throw new BadRequestException("Account does not belong to this company");
    }
  }
}
