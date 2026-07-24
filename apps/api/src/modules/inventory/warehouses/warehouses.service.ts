import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import type { CreateWarehouseDto } from "./dto/create-warehouse.dto";
import type { ListWarehousesQueryDto } from "./dto/list-warehouses-query.dto";
import type { UpdateWarehouseDto } from "./dto/update-warehouse.dto";

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListWarehousesQueryDto, "search" | "isActive">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" as const } },
              { code: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };
  }

  async list(companyId: string, query: ListWarehousesQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.warehouse.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { stockItems: true } } },
      }),
      this.prisma.warehouse.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const warehouse = await this.prisma.warehouse.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!warehouse) {
      throw new NotFoundException("Warehouse not found");
    }
    return warehouse;
  }

  async create(companyId: string, dto: CreateWarehouseDto) {
    const existing = await this.prisma.warehouse.findFirst({ where: { companyId, code: dto.code, deletedAt: null } });
    if (existing) {
      throw new ConflictException("A warehouse with this code already exists");
    }
    return this.prisma.warehouse.create({ data: { companyId, ...dto } });
  }

  async update(companyId: string, id: string, dto: UpdateWarehouseDto) {
    await this.findOne(companyId, id);
    if (dto.code) {
      const existing = await this.prisma.warehouse.findFirst({
        where: { companyId, code: dto.code, deletedAt: null, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException("A warehouse with this code already exists");
      }
    }
    return this.prisma.warehouse.update({ where: { id }, data: dto });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.findOne(companyId, id);
    const stockCount = await this.prisma.stockItem.count({
      where: { warehouseId: id, quantityOnHand: { not: 0 } },
    });
    if (stockCount > 0) {
      throw new ForbiddenException("Cannot delete a warehouse that still holds stock");
    }
    await this.prisma.warehouse.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
