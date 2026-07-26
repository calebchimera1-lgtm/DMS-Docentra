import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CreateSupplierDto } from "./dto/create-supplier.dto";
import type { ListSuppliersQueryDto } from "./dto/list-suppliers-query.dto";
import type { UpdateSupplierDto } from "./dto/update-supplier.dto";

const EXPORT_ROW_LIMIT = 5000;

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListSuppliersQueryDto, "search" | "isActive">) {
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

  async list(companyId: string, query: ListSuppliersQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!supplier) {
      throw new NotFoundException("Supplier not found");
    }
    return supplier;
  }

  async create(companyId: string, dto: CreateSupplierDto) {
    const existing = await this.prisma.supplier.findFirst({
      where: { companyId, code: dto.code, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException("A supplier with this code already exists");
    }
    return this.prisma.supplier.create({ data: { companyId, ...dto } });
  }

  async update(companyId: string, id: string, dto: UpdateSupplierDto) {
    await this.findOne(companyId, id);
    if (dto.code) {
      const existing = await this.prisma.supplier.findFirst({
        where: { companyId, code: dto.code, deletedAt: null, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException("A supplier with this code already exists");
      }
    }
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.findOne(companyId, id);
    const orderCount = await this.prisma.purchaseOrder.count({ where: { supplierId: id, deletedAt: null } });
    if (orderCount > 0) {
      throw new ForbiddenException("Cannot delete a supplier that has purchase orders");
    }
    await this.prisma.supplier.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(companyId: string, query: Pick<ListSuppliersQueryDto, "search" | "isActive">): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.supplier.findMany({
      where,
      orderBy: { name: "asc" },
      take: EXPORT_ROW_LIMIT,
      select: { id: true, code: true, name: true, email: true, phone: true, isActive: true },
    });
    return toCsv(rows, ["id", "code", "name", "email", "phone", "isActive"]);
  }
}
