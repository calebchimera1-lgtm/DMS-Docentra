import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CreateBomDto } from "./dto/create-bom.dto";
import type { ListBomsQueryDto } from "./dto/list-boms-query.dto";
import type { UpdateBomDto } from "./dto/update-bom.dto";

const EXPORT_ROW_LIMIT = 5000;

const bomInclude = {
  product: { select: { id: true, sku: true, name: true } },
  lines: { include: { componentProduct: { select: { id: true, sku: true, name: true } } } },
} as const;

@Injectable()
export class BomsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListBomsQueryDto, "search" | "productId" | "isActive">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" as const } } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };
  }

  private async assertProductBelongsToCompany(companyId: string, productId: string): Promise<void> {
    const count = await this.prisma.product.count({ where: { id: productId, companyId, deletedAt: null } });
    if (count === 0) {
      throw new BadRequestException("Product does not belong to this company");
    }
  }

  private async validateLines(companyId: string, productId: string, lines: { componentProductId: string; quantity: number }[]) {
    if (lines.some((line) => line.componentProductId === productId)) {
      throw new BadRequestException("A product cannot be a component of its own BOM");
    }
    const componentIds = Array.from(new Set(lines.map((line) => line.componentProductId)));
    const count = await this.prisma.product.count({
      where: { id: { in: componentIds }, companyId, deletedAt: null },
    });
    if (count !== componentIds.length) {
      throw new BadRequestException("One or more component products do not belong to this company");
    }
  }

  async list(companyId: string, query: ListBomsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.billOfMaterial.findMany({
        where,
        include: bomInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.billOfMaterial.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const bom = await this.prisma.billOfMaterial.findFirst({
      where: { id, companyId, deletedAt: null },
      include: bomInclude,
    });
    if (!bom) {
      throw new NotFoundException("Bill of material not found");
    }
    return bom;
  }

  async create(companyId: string, dto: CreateBomDto) {
    await this.assertProductBelongsToCompany(companyId, dto.productId);
    await this.validateLines(companyId, dto.productId, dto.lines);

    return this.prisma.billOfMaterial.create({
      data: {
        companyId,
        productId: dto.productId,
        name: dto.name,
        isActive: dto.isActive ?? true,
        note: dto.note,
        lines: {
          create: dto.lines.map((line) => ({
            componentProductId: line.componentProductId,
            quantity: line.quantity,
          })),
        },
      },
      include: bomInclude,
    });
  }

  async update(companyId: string, id: string, dto: UpdateBomDto) {
    const existing = await this.findOne(companyId, id);
    const productId = dto.productId ?? existing.productId;
    if (dto.productId) {
      await this.assertProductBelongsToCompany(companyId, dto.productId);
    }
    if (dto.lines) {
      await this.validateLines(companyId, productId, dto.lines);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.bomLine.deleteMany({ where: { bomId: id } });
      }
      return tx.billOfMaterial.update({
        where: { id },
        data: {
          productId: dto.productId,
          name: dto.name,
          isActive: dto.isActive,
          note: dto.note,
          ...(dto.lines
            ? {
                lines: {
                  create: dto.lines.map((line) => ({
                    componentProductId: line.componentProductId,
                    quantity: line.quantity,
                  })),
                },
              }
            : {}),
        },
        include: bomInclude,
      });
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.findOne(companyId, id);
    await this.prisma.billOfMaterial.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(companyId: string, query: Pick<ListBomsQueryDto, "search" | "productId" | "isActive">): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.billOfMaterial.findMany({
      where,
      include: bomInclude,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      name: r.name,
      product: r.product.sku,
      lineCount: r.lines.length,
      isActive: r.isActive,
    }));
    return toCsv(flat, ["name", "product", "lineCount", "isActive"]);
  }
}
