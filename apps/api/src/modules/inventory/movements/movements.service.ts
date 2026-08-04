import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import type { StockMovementType } from "@omniflow/database";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CreateMovementDto } from "./dto/create-movement.dto";
import type { ListMovementsQueryDto } from "./dto/list-movements-query.dto";

const EXPORT_ROW_LIMIT = 5000;

const movementInclude = {
  product: { select: { id: true, sku: true, name: true } },
  warehouse: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

const OUTBOUND_TYPES = new Set<StockMovementType>(["SALE", "TRANSFER_OUT"]);
const INBOUND_TYPES = new Set<StockMovementType>(["RECEIPT", "RETURN", "TRANSFER_IN"]);

@Injectable()
export class MovementsService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveDelta(type: StockMovementType, quantity: number): number {
    if (INBOUND_TYPES.has(type)) return Math.abs(quantity);
    if (OUTBOUND_TYPES.has(type)) return -Math.abs(quantity);
    return quantity; // ADJUSTMENT: signed, as provided
  }

  async list(companyId: string, query: ListMovementsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      companyId,
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: movementInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async create(companyId: string, userId: string, dto: CreateMovementDto) {
    const [product, warehouse] = await Promise.all([
      this.prisma.product.findFirst({ where: { id: dto.productId, companyId, deletedAt: null } }),
      this.prisma.warehouse.findFirst({ where: { id: dto.warehouseId, companyId, deletedAt: null } }),
    ]);
    if (!product) {
      throw new NotFoundException("Product not found");
    }
    if (!warehouse) {
      throw new NotFoundException("Warehouse not found");
    }

    const delta = this.resolveDelta(dto.type, dto.quantity);

    return this.prisma.$transaction(async (tx) => {
      const stockItem = await tx.stockItem.upsert({
        where: { productId_warehouseId: { productId: dto.productId, warehouseId: dto.warehouseId } },
        create: { companyId, productId: dto.productId, warehouseId: dto.warehouseId, quantityOnHand: 0 },
        update: {},
      });

      const newQuantity = stockItem.quantityOnHand + delta;
      if (newQuantity < 0) {
        throw new BadRequestException(
          `Insufficient stock: ${stockItem.quantityOnHand} on hand, cannot move ${delta}`,
        );
      }

      await tx.stockItem.update({ where: { id: stockItem.id }, data: { quantityOnHand: newQuantity } });

      return tx.stockMovement.create({
        data: {
          companyId,
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          type: dto.type,
          quantity: delta,
          reference: dto.reference,
          note: dto.note,
          createdById: userId,
        },
        include: movementInclude,
      });
    });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListMovementsQueryDto, "productId" | "warehouseId" | "type">,
  ): Promise<string> {
    const where = {
      companyId,
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.type ? { type: query.type } : {}),
    };
    const rows = await this.prisma.stockMovement.findMany({
      where,
      include: movementInclude,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      sku: r.product.sku,
      warehouse: r.warehouse.name,
      type: r.type,
      quantity: r.quantity,
      reference: r.reference ?? "",
      createdAt: r.createdAt,
    }));
    return toCsv(flat, ["sku", "warehouse", "type", "quantity", "reference", "createdAt"]);
  }
}
