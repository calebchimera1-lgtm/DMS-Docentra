import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CreateProductDto } from "./dto/create-product.dto";
import type { ListProductsQueryDto } from "./dto/list-products-query.dto";
import type { UpdateProductDto } from "./dto/update-product.dto";

const EXPORT_ROW_LIMIT = 5000;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListProductsQueryDto, "search" | "isActive">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" as const } },
              { sku: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };
  }

  async list(companyId: string, query: ListProductsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!product) {
      throw new NotFoundException("Product not found");
    }
    return product;
  }

  async create(companyId: string, dto: CreateProductDto) {
    const existing = await this.prisma.product.findFirst({ where: { companyId, sku: dto.sku, deletedAt: null } });
    if (existing) {
      throw new ConflictException("A product with this SKU already exists");
    }
    return this.prisma.product.create({ data: { companyId, ...dto } });
  }

  async update(companyId: string, id: string, dto: UpdateProductDto) {
    await this.findOne(companyId, id);
    if (dto.sku) {
      const existing = await this.prisma.product.findFirst({
        where: { companyId, sku: dto.sku, deletedAt: null, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException("A product with this SKU already exists");
      }
    }
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.findOne(companyId, id);
    await this.prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(companyId: string, query: Pick<ListProductsQueryDto, "search" | "isActive">): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
      select: { id: true, sku: true, name: true, unitPriceCents: true, currency: true, isActive: true, createdAt: true },
    });
    return toCsv(rows, ["id", "sku", "name", "unitPriceCents", "currency", "isActive", "createdAt"]);
  }
}
