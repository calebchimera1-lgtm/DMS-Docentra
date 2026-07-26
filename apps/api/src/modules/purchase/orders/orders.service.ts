import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import { priceLineItems } from "../../sales/common/line-item.dto";
import { formatDocumentNumber } from "../../sales/common/document-number.util";
import type { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";
import type { ListPurchaseOrdersQueryDto } from "./dto/list-purchase-orders-query.dto";
import type { UpdatePurchaseOrderDto } from "./dto/update-purchase-order.dto";

const EXPORT_ROW_LIMIT = 5000;

const orderInclude = {
  supplier: { select: { id: true, name: true, code: true } },
  warehouse: { select: { id: true, name: true, code: true } },
  goodsReceipt: { select: { id: true, receiptNumber: true } },
} as const;

interface PurchaseLineItem {
  productId?: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListPurchaseOrdersQueryDto, "search" | "status" | "supplierId">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search ? { orderNumber: { contains: query.search, mode: "insensitive" as const } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    };
  }

  private async assertSupplierBelongsToCompany(companyId: string, supplierId: string): Promise<void> {
    const count = await this.prisma.supplier.count({ where: { id: supplierId, companyId, deletedAt: null } });
    if (count === 0) {
      throw new BadRequestException("Supplier does not belong to this company");
    }
  }

  private async assertWarehouseBelongsToCompany(companyId: string, warehouseId: string): Promise<void> {
    const count = await this.prisma.warehouse.count({ where: { id: warehouseId, companyId, deletedAt: null } });
    if (count === 0) {
      throw new BadRequestException("Warehouse does not belong to this company");
    }
  }

  async list(companyId: string, query: ListPurchaseOrdersQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: orderInclude,
    });
    if (!order) {
      throw new NotFoundException("Purchase order not found");
    }
    return order;
  }

  async create(companyId: string, userId: string, dto: CreatePurchaseOrderDto) {
    await this.assertSupplierBelongsToCompany(companyId, dto.supplierId);
    await this.assertWarehouseBelongsToCompany(companyId, dto.warehouseId);
    const { items, subtotalCents } = priceLineItems(dto.items);

    const count = await this.prisma.purchaseOrder.count({ where: { companyId } });
    return this.prisma.purchaseOrder.create({
      data: {
        companyId,
        supplierId: dto.supplierId,
        warehouseId: dto.warehouseId,
        createdById: userId,
        orderNumber: formatDocumentNumber("PO", count),
        items: items as unknown as object,
        subtotalCents,
        totalCents: subtotalCents,
        currency: dto.currency ?? "USD",
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
      },
      include: orderInclude,
    });
  }

  async update(companyId: string, id: string, dto: UpdatePurchaseOrderDto) {
    const existing = await this.findOne(companyId, id);
    if (existing.status === "RECEIVED" || existing.status === "CANCELLED") {
      throw new BadRequestException(`A ${existing.status.toLowerCase()} purchase order cannot be edited`);
    }
    if (dto.supplierId) {
      await this.assertSupplierBelongsToCompany(companyId, dto.supplierId);
    }
    if (dto.warehouseId) {
      await this.assertWarehouseBelongsToCompany(companyId, dto.warehouseId);
    }
    const priced = dto.items ? priceLineItems(dto.items) : null;

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        supplierId: dto.supplierId,
        warehouseId: dto.warehouseId,
        items: priced?.items as unknown as object | undefined,
        subtotalCents: priced?.subtotalCents,
        totalCents: priced?.subtotalCents,
        currency: dto.currency,
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
        status: dto.status,
      },
      include: orderInclude,
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    const existing = await this.findOne(companyId, id);
    if (existing.status !== "DRAFT" && existing.status !== "CANCELLED") {
      throw new ForbiddenException("Only a draft or cancelled purchase order can be deleted");
    }
    await this.prisma.purchaseOrder.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /**
   * Receiving is a dedicated action, not a plain status update, because it
   * has a real side effect: it transactionally posts an inbound
   * StockMovement per line item and bumps StockItem quantities, reusing
   * Inventory's own movement-recording logic rather than re-implementing it.
   */
  async receive(companyId: string, userId: string, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { goodsReceipt: true },
    });
    if (!order) {
      throw new NotFoundException("Purchase order not found");
    }
    if (order.status !== "CONFIRMED") {
      throw new BadRequestException("Only a confirmed purchase order can be received");
    }
    if (order.goodsReceipt) {
      throw new BadRequestException("This purchase order has already been received");
    }

    const lines = order.items as unknown as PurchaseLineItem[];
    const receiptCount = await this.prisma.goodsReceipt.count({ where: { companyId } });

    return this.prisma.$transaction(async (tx) => {
      for (const line of lines) {
        if (!line.productId) continue;

        const stockItem = await tx.stockItem.upsert({
          where: { productId_warehouseId: { productId: line.productId, warehouseId: order.warehouseId! } },
          create: { companyId, productId: line.productId, warehouseId: order.warehouseId!, quantityOnHand: 0 },
          update: {},
        });
        await tx.stockItem.update({
          where: { id: stockItem.id },
          data: { quantityOnHand: stockItem.quantityOnHand + line.quantity },
        });
        await tx.stockMovement.create({
          data: {
            companyId,
            productId: line.productId,
            warehouseId: order.warehouseId!,
            type: "RECEIPT",
            quantity: line.quantity,
            reference: order.orderNumber,
            note: `Received from purchase order ${order.orderNumber}`,
            createdById: userId,
          },
        });
      }

      const receipt = await tx.goodsReceipt.create({
        data: {
          companyId,
          purchaseOrderId: order.id,
          warehouseId: order.warehouseId!,
          receivedById: userId,
          receiptNumber: formatDocumentNumber("GR", receiptCount),
          items: order.items as object,
        },
      });

      await tx.purchaseOrder.update({ where: { id: order.id }, data: { status: "RECEIVED" } });

      return receipt;
    });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListPurchaseOrdersQueryDto, "search" | "status" | "supplierId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.purchaseOrder.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      orderNumber: r.orderNumber,
      supplier: r.supplier.name,
      warehouse: r.warehouse?.name ?? "",
      status: r.status,
      totalCents: r.totalCents,
      currency: r.currency,
      expectedDate: r.expectedDate ?? "",
    }));
    return toCsv(flat, ["orderNumber", "supplier", "warehouse", "status", "totalCents", "currency", "expectedDate"]);
  }
}
