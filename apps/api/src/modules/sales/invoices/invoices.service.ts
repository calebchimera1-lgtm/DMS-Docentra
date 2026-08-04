import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import { DomainEvents } from "../../../common/events/domain-events";
import { priceLineItems } from "../common/line-item.dto";
import { formatDocumentNumber } from "../common/document-number.util";
import { postInvoiceReceivable } from "../common/sales-posting.util";
import type { CreateInvoiceDto } from "./dto/create-invoice.dto";
import type { ListInvoicesQueryDto } from "./dto/list-invoices-query.dto";
import type { UpdateInvoiceDto } from "./dto/update-invoice.dto";

const EXPORT_ROW_LIMIT = 5000;

const invoiceInclude = {
  account: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  salesOrder: { select: { id: true, orderNumber: true } },
} as const;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  private buildWhere(companyId: string, query: Pick<ListInvoicesQueryDto, "search" | "status" | "accountId">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search ? { invoiceNumber: { contains: query.search, mode: "insensitive" as const } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
    };
  }

  async list(companyId: string, query: ListInvoicesQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: invoiceInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId, deletedAt: null },
      include: invoiceInclude,
    });
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }
    return invoice;
  }

  async create(companyId: string, dto: CreateInvoiceDto) {
    await this.assertAccountBelongsToCompany(companyId, dto.accountId);
    const { items, subtotalCents } = priceLineItems(dto.items);

    return this.prisma.$transaction(async (tx) => {
      const count = await tx.invoice.count({ where: { companyId } });
      const invoiceNumber = formatDocumentNumber("INV", count);
      const invoice = await tx.invoice.create({
        data: {
          companyId,
          accountId: dto.accountId,
          contactId: dto.contactId,
          invoiceNumber,
          items: items as unknown as object,
          totalCents: subtotalCents,
          currency: dto.currency ?? "USD",
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          ownerId: dto.ownerId,
        },
        include: invoiceInclude,
      });

      await postInvoiceReceivable(tx, companyId, invoiceNumber, invoice.totalCents);

      return invoice;
    });
  }

  async update(companyId: string, id: string, dto: UpdateInvoiceDto) {
    await this.findOne(companyId, id);
    if (dto.accountId) {
      await this.assertAccountBelongsToCompany(companyId, dto.accountId);
    }
    const priced = dto.items ? priceLineItems(dto.items) : null;

    return this.prisma.invoice.update({
      where: { id },
      data: {
        accountId: dto.accountId,
        contactId: dto.contactId,
        items: priced?.items as unknown as object | undefined,
        totalCents: priced?.subtotalCents,
        currency: dto.currency,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: dto.status,
      },
      include: invoiceInclude,
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.findOne(companyId, id);
    await this.prisma.invoice.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async markPaid(companyId: string, id: string) {
    const invoice = await this.findOne(companyId, id);
    if (invoice.status === "PAID") {
      throw new BadRequestException("Invoice is already marked as paid");
    }
    if (invoice.status === "CANCELLED") {
      throw new BadRequestException("A cancelled invoice cannot be marked as paid");
    }
    const paid = await this.prisma.invoice.update({
      where: { id },
      data: { status: "PAID", paidAt: new Date() },
      include: invoiceInclude,
    });
    this.events.emit(DomainEvents.INVOICE_PAID, {
      companyId,
      invoiceId: paid.id,
      invoiceNumber: paid.invoiceNumber,
      ownerId: paid.ownerId,
    });
    return paid;
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListInvoicesQueryDto, "search" | "status" | "accountId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalCents: true,
        currency: true,
        dueDate: true,
        paidAt: true,
        createdAt: true,
      },
    });
    return toCsv(rows, ["id", "invoiceNumber", "status", "totalCents", "currency", "dueDate", "paidAt", "createdAt"]);
  }

  private async assertAccountBelongsToCompany(companyId: string, accountId: string): Promise<void> {
    const count = await this.prisma.crmAccount.count({ where: { id: accountId, companyId, deletedAt: null } });
    if (count === 0) {
      throw new BadRequestException("Account does not belong to this company");
    }
  }
}
