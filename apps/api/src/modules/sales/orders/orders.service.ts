import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import { DomainEvents } from "../../../common/events/domain-events";
import { priceLineItems, type PricedLineItem } from "../common/line-item.dto";
import { formatDocumentNumber } from "../common/document-number.util";
import { postInvoiceReceivable } from "../common/sales-posting.util";
import type { CreateSalesOrderDto } from "./dto/create-order.dto";
import type { FulfillOrderDto } from "./dto/fulfill-order.dto";
import type { ListOrdersQueryDto } from "./dto/list-orders-query.dto";
import type { UpdateSalesOrderDto } from "./dto/update-order.dto";

const EXPORT_ROW_LIMIT = 5000;
const DEFAULT_INVOICE_TERMS_DAYS = 30;

const orderInclude = {
  account: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  quote: { select: { id: true, quoteNumber: true } },
  warehouse: { select: { id: true, name: true, code: true } },
} as const;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

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
    if (dto.warehouseId) {
      await this.assertWarehouseBelongsToCompany(companyId, dto.warehouseId);
    }
    const { items, subtotalCents } = priceLineItems(dto.items);

    const count = await this.prisma.salesOrder.count({ where: { companyId } });
    return this.prisma.salesOrder.create({
      data: {
        companyId,
        accountId: dto.accountId,
        contactId: dto.contactId,
        warehouseId: dto.warehouseId,
        orderNumber: formatDocumentNumber("SO", count),
        items: items as unknown as object,
        totalCents: subtotalCents,
        currency: dto.currency ?? "USD",
        ownerId: dto.ownerId,
      },
      include: orderInclude,
    });
  }

  async update(companyId: string, id: string, dto: UpdateSalesOrderDto) {
    await this.findOne(companyId, id);
    if (dto.accountId) {
      await this.assertAccountBelongsToCompany(companyId, dto.accountId);
    }
    if (dto.warehouseId) {
      await this.assertWarehouseBelongsToCompany(companyId, dto.warehouseId);
    }
    if (dto.status === "FULFILLED") {
      throw new BadRequestException("Use POST /sales/orders/:id/fulfill to fulfill an order — it deducts stock");
    }
    const priced = dto.items ? priceLineItems(dto.items) : null;

    return this.prisma.salesOrder.update({
      where: { id },
      data: {
        accountId: dto.accountId,
        contactId: dto.contactId,
        warehouseId: dto.warehouseId,
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

  /**
   * Deducts stock for each line item that has a productId and records the
   * StockMovement — the "reduce inventory / record the stock movement"
   * step the audit found missing entirely. Mirrors the pattern POS Sales
   * already uses (direct tx.stockItem/tx.stockMovement writes inside this
   * method's own transaction, not a nested call into MovementsService,
   * which opens its own transaction and can't be composed into this one).
   */
  async fulfill(companyId: string, userId: string, id: string, dto: FulfillOrderDto) {
    const order = await this.prisma.salesOrder.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!order) {
      throw new NotFoundException("Sales order not found");
    }
    if (order.status === "FULFILLED") {
      throw new BadRequestException("This order has already been fulfilled");
    }
    if (order.status === "CANCELLED") {
      throw new BadRequestException("A cancelled order cannot be fulfilled");
    }

    const warehouseId = dto.warehouseId ?? order.warehouseId;
    if (!warehouseId) {
      throw new BadRequestException("A warehouseId is required to fulfill this order");
    }
    await this.assertWarehouseBelongsToCompany(companyId, warehouseId);

    const items = order.items as unknown as PricedLineItem[];
    const productIds = Array.from(new Set(items.filter((i) => i.productId).map((i) => i.productId as string)));
    let skuById = new Map<string, string>();
    if (productIds.length > 0) {
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds }, companyId, deletedAt: null },
        select: { id: true, sku: true },
      });
      skuById = new Map(products.map((p) => [p.id, p.sku]));
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (!item.productId) continue;
        const stockItem = await tx.stockItem.upsert({
          where: { productId_warehouseId: { productId: item.productId, warehouseId } },
          create: { companyId, productId: item.productId, warehouseId, quantityOnHand: 0 },
          update: {},
        });
        const newQuantity = stockItem.quantityOnHand - item.quantity;
        if (newQuantity < 0) {
          throw new BadRequestException(
            `Insufficient stock for ${skuById.get(item.productId) ?? item.productId}: ${stockItem.quantityOnHand} on hand, cannot fulfill ${item.quantity}`,
          );
        }
        await tx.stockItem.update({ where: { id: stockItem.id }, data: { quantityOnHand: newQuantity } });
        await tx.stockMovement.create({
          data: {
            companyId,
            productId: item.productId,
            warehouseId,
            type: "SALE",
            quantity: -item.quantity,
            reference: order.orderNumber,
            note: `Fulfilled sales order ${order.orderNumber}`,
            createdById: userId,
          },
        });
      }

      return tx.salesOrder.update({
        where: { id: order.id },
        data: { status: "FULFILLED", warehouseId },
        include: orderInclude,
      });
    }).then((fulfilled) => {
      this.events.emit(DomainEvents.SALES_ORDER_FULFILLED, {
        companyId,
        orderId: fulfilled.id,
        orderNumber: fulfilled.orderNumber,
        ownerId: fulfilled.ownerId,
      });
      return fulfilled;
    });
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

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + DEFAULT_INVOICE_TERMS_DAYS);

    return this.prisma.$transaction(async (tx) => {
      const count = await tx.invoice.count({ where: { companyId } });
      const invoiceNumber = formatDocumentNumber("INV", count);
      const invoice = await tx.invoice.create({
        data: {
          companyId,
          accountId: order.accountId,
          contactId: order.contactId,
          salesOrderId: order.id,
          invoiceNumber,
          items: order.items as object,
          totalCents: order.totalCents,
          currency: order.currency,
          dueDate,
          ownerId: order.ownerId,
        },
      });

      await postInvoiceReceivable(tx, companyId, invoiceNumber, invoice.totalCents);

      return invoice;
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

  private async assertWarehouseBelongsToCompany(companyId: string, warehouseId: string): Promise<void> {
    const count = await this.prisma.warehouse.count({ where: { id: warehouseId, companyId, deletedAt: null } });
    if (count === 0) {
      throw new BadRequestException("Warehouse does not belong to this company");
    }
  }
}
