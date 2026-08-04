import { Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { ListStockQueryDto } from "./dto/list-stock-query.dto";
import type { UpdateStockSettingsDto } from "./dto/update-stock-settings.dto";

const EXPORT_ROW_LIMIT = 5000;

const stockInclude = {
  product: { select: { id: true, sku: true, name: true, unitPriceCents: true, currency: true } },
  warehouse: { select: { id: true, name: true, code: true } },
} as const;

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListStockQueryDto, "search" | "warehouseId" | "productId">) {
    return {
      companyId,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.search
        ? {
            product: {
              OR: [
                { name: { contains: query.search, mode: "insensitive" as const } },
                { sku: { contains: query.search, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
    };
  }

  /**
   * Low-stock filtering compares two columns on the same row
   * (quantityOnHand <= reorderPoint), which Prisma's query builder can't
   * express directly — fetched unpaginated and filtered/paginated in
   * memory instead. Fine at the scale a single company's stock table
   * reaches; would need a raw query or a generated column at real scale.
   */
  async list(companyId: string, query: ListStockQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    if (query.lowStock) {
      const all = await this.prisma.stockItem.findMany({
        where,
        include: stockInclude,
        orderBy: { updatedAt: "desc" },
      });
      const low = all.filter((item) => item.quantityOnHand <= item.reorderPoint);
      const total = low.length;
      const items = low.slice((page - 1) * pageSize, page * pageSize);
      return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
    }

    const [items, total] = await Promise.all([
      this.prisma.stockItem.findMany({
        where,
        include: stockInclude,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.stockItem.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const stockItem = await this.prisma.stockItem.findFirst({
      where: { id, companyId },
      include: stockInclude,
    });
    if (!stockItem) {
      throw new NotFoundException("Stock item not found");
    }
    return stockItem;
  }

  async updateSettings(companyId: string, id: string, dto: UpdateStockSettingsDto) {
    await this.findOne(companyId, id);
    return this.prisma.stockItem.update({ where: { id }, data: dto, include: stockInclude });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListStockQueryDto, "search" | "warehouseId" | "productId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.stockItem.findMany({
      where,
      include: stockInclude,
      orderBy: { updatedAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      sku: r.product.sku,
      productName: r.product.name,
      warehouse: r.warehouse.name,
      quantityOnHand: r.quantityOnHand,
      reorderPoint: r.reorderPoint,
    }));
    return toCsv(flat, ["sku", "productName", "warehouse", "quantityOnHand", "reorderPoint"]);
  }
}
