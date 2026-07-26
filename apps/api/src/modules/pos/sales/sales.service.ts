import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import type { PaymentMethod, Prisma } from "@omniflow/database";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import { priceLineItems, type PricedLineItem } from "../../sales/common/line-item.dto";
import { formatDocumentNumber } from "../../sales/common/document-number.util";
import type { CreateSaleDto } from "./dto/create-sale.dto";
import type { ListSalesQueryDto } from "./dto/list-sales-query.dto";
import type { RefundSaleDto } from "./dto/refund-sale.dto";
import type { VoidSaleDto } from "./dto/void-sale.dto";

const EXPORT_ROW_LIMIT = 5000;

const saleInclude = {
  session: { select: { id: true, sessionNumber: true, status: true } },
  warehouse: { select: { id: true, name: true, code: true } },
  account: { select: { id: true, name: true } },
  soldBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(
    companyId: string,
    query: Pick<ListSalesQueryDto, "search" | "status" | "paymentMethod" | "sessionId">,
  ) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search ? { saleNumber: { contains: query.search, mode: "insensitive" as const } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(query.sessionId ? { sessionId: query.sessionId } : {}),
    };
  }

  async list(companyId: string, query: ListSalesQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.posSale.findMany({
        where,
        include: saleInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.posSale.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const sale = await this.prisma.posSale.findFirst({
      where: { id, companyId, deletedAt: null },
      include: saleInclude,
    });
    if (!sale) {
      throw new NotFoundException("Sale not found");
    }
    return sale;
  }

  /**
   * Ringing up a sale has no draft stage — it deducts stock immediately,
   * the same "reuse Inventory's own movement-recording logic" convention
   * every stock-moving action in this codebase follows, posting the
   * existing SALE StockMovementType and the same "Insufficient stock"
   * guard Inventory's manual movements and Manufacturing's work orders use.
   */
  async create(companyId: string, userId: string, dto: CreateSaleDto) {
    const session = await this.prisma.posRegisterSession.findFirst({
      where: { id: dto.sessionId, companyId, deletedAt: null },
    });
    if (!session) {
      throw new BadRequestException("Register session does not belong to this company");
    }
    if (session.status !== "OPEN") {
      throw new BadRequestException("Sales can only be recorded against an open register session");
    }
    if (dto.accountId) {
      const account = await this.prisma.crmAccount.count({
        where: { id: dto.accountId, companyId, deletedAt: null },
      });
      if (account === 0) {
        throw new BadRequestException("Account does not belong to this company");
      }
    }

    const { items, subtotalCents } = priceLineItems(dto.items);
    const totalCents = subtotalCents;
    const paymentMethod: PaymentMethod = dto.paymentMethod ?? "CASH";

    let changeDueCents: number | undefined;
    if (paymentMethod === "CASH") {
      if (dto.amountTenderedCents === undefined || dto.amountTenderedCents < totalCents) {
        throw new BadRequestException("Amount tendered must be provided and at least the sale total for a cash sale");
      }
      changeDueCents = dto.amountTenderedCents - totalCents;
    }

    const productIds = Array.from(new Set(items.filter((i) => i.productId).map((i) => i.productId as string)));
    let skuById = new Map<string, string>();
    if (productIds.length > 0) {
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds }, companyId, deletedAt: null },
        select: { id: true, sku: true },
      });
      if (products.length !== productIds.length) {
        throw new BadRequestException("One or more products do not belong to this company");
      }
      skuById = new Map(products.map((p) => [p.id, p.sku]));
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (!item.productId) continue;
        const stockItem = await tx.stockItem.upsert({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: session.warehouseId } },
          create: { companyId, productId: item.productId, warehouseId: session.warehouseId, quantityOnHand: 0 },
          update: {},
        });
        const newQuantity = stockItem.quantityOnHand - item.quantity;
        if (newQuantity < 0) {
          throw new BadRequestException(
            `Insufficient stock for ${skuById.get(item.productId)}: ${stockItem.quantityOnHand} on hand, cannot sell ${item.quantity}`,
          );
        }
        await tx.stockItem.update({ where: { id: stockItem.id }, data: { quantityOnHand: newQuantity } });
      }

      const count = await tx.posSale.count({ where: { companyId } });
      const saleNumber = formatDocumentNumber("POS", count);

      for (const item of items) {
        if (!item.productId) continue;
        await tx.stockMovement.create({
          data: {
            companyId,
            productId: item.productId,
            warehouseId: session.warehouseId,
            type: "SALE",
            quantity: -item.quantity,
            reference: saleNumber,
            note: `Sold via POS sale ${saleNumber}`,
            createdById: userId,
          },
        });
      }

      return tx.posSale.create({
        data: this.buildCreateData(
          companyId,
          userId,
          session.id,
          session.warehouseId,
          saleNumber,
          dto,
          items,
          subtotalCents,
          totalCents,
          paymentMethod,
          changeDueCents,
        ),
        include: saleInclude,
      });
    });
  }

  private buildCreateData(
    companyId: string,
    userId: string,
    sessionId: string,
    warehouseId: string,
    saleNumber: string,
    dto: CreateSaleDto,
    items: PricedLineItem[],
    subtotalCents: number,
    totalCents: number,
    paymentMethod: PaymentMethod,
    changeDueCents: number | undefined,
  ) {
    return {
      companyId,
      saleNumber,
      sessionId,
      warehouseId,
      accountId: dto.accountId,
      soldById: userId,
      items: items as unknown as object,
      subtotalCents,
      totalCents,
      paymentMethod,
      amountTenderedCents: dto.amountTenderedCents,
      changeDueCents,
    };
  }

  private async restock(
    tx: Prisma.TransactionClient,
    companyId: string,
    userId: string,
    sale: { items: unknown; warehouseId: string; saleNumber: string },
    reason: string,
  ) {
    const items = sale.items as PricedLineItem[];
    for (const item of items) {
      if (!item.productId) continue;
      const stockItem = await tx.stockItem.upsert({
        where: { productId_warehouseId: { productId: item.productId, warehouseId: sale.warehouseId } },
        create: { companyId, productId: item.productId, warehouseId: sale.warehouseId, quantityOnHand: 0 },
        update: {},
      });
      await tx.stockItem.update({
        where: { id: stockItem.id },
        data: { quantityOnHand: stockItem.quantityOnHand + item.quantity },
      });
      await tx.stockMovement.create({
        data: {
          companyId,
          productId: item.productId,
          warehouseId: sale.warehouseId,
          type: "RETURN",
          quantity: item.quantity,
          reference: sale.saleNumber,
          note: `${reason} POS sale ${sale.saleNumber}`,
          createdById: userId,
        },
      });
    }
  }

  async void(companyId: string, userId: string, id: string, dto: VoidSaleDto) {
    const sale = await this.findOne(companyId, id);
    if (sale.status !== "COMPLETED") {
      throw new BadRequestException("Only a completed sale can be voided");
    }
    if (sale.session.status !== "OPEN") {
      throw new BadRequestException("A sale can only be voided while its register session is still open");
    }

    return this.prisma.$transaction(async (tx) => {
      await this.restock(tx, companyId, userId, sale, "Voided");
      return tx.posSale.update({
        where: { id },
        data: { status: "VOIDED", voidedAt: new Date(), voidReason: dto.voidReason },
        include: saleInclude,
      });
    });
  }

  async refund(companyId: string, userId: string, id: string, dto: RefundSaleDto) {
    const sale = await this.findOne(companyId, id);
    if (sale.status !== "COMPLETED") {
      throw new BadRequestException("Only a completed sale can be refunded");
    }

    return this.prisma.$transaction(async (tx) => {
      await this.restock(tx, companyId, userId, sale, "Refunded");
      return tx.posSale.update({
        where: { id },
        data: { status: "REFUNDED", refundedAt: new Date(), refundReason: dto.refundReason },
        include: saleInclude,
      });
    });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListSalesQueryDto, "search" | "status" | "paymentMethod" | "sessionId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.posSale.findMany({
      where,
      include: saleInclude,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      saleNumber: r.saleNumber,
      session: r.session.sessionNumber,
      account: r.account?.name ?? "",
      paymentMethod: r.paymentMethod,
      totalCents: r.totalCents,
      currency: r.currency,
      status: r.status,
      createdAt: r.createdAt,
    }));
    return toCsv(flat, ["saleNumber", "session", "account", "paymentMethod", "totalCents", "currency", "status", "createdAt"]);
  }
}
