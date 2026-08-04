import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CreateSalaryComponentDto } from "./dto/create-salary-component.dto";
import type { ListSalaryComponentsQueryDto } from "./dto/list-salary-components-query.dto";
import type { UpdateSalaryComponentDto } from "./dto/update-salary-component.dto";

const EXPORT_ROW_LIMIT = 5000;

@Injectable()
export class SalaryComponentsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListSalaryComponentsQueryDto, "search" | "type" | "isActive">) {
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
      ...(query.type ? { type: query.type } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };
  }

  async list(companyId: string, query: ListSalaryComponentsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.salaryComponent.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.salaryComponent.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const component = await this.prisma.salaryComponent.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!component) {
      throw new NotFoundException("Salary component not found");
    }
    return component;
  }

  async create(companyId: string, dto: CreateSalaryComponentDto) {
    const existing = await this.prisma.salaryComponent.findFirst({
      where: { companyId, code: dto.code, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException("A salary component with this code already exists");
    }
    return this.prisma.salaryComponent.create({ data: { companyId, ...dto } });
  }

  async update(companyId: string, id: string, dto: UpdateSalaryComponentDto) {
    await this.findOne(companyId, id);
    if (dto.code) {
      const existing = await this.prisma.salaryComponent.findFirst({
        where: { companyId, code: dto.code, deletedAt: null, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException("A salary component with this code already exists");
      }
    }
    return this.prisma.salaryComponent.update({ where: { id }, data: dto });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.findOne(companyId, id);
    await this.prisma.salaryComponent.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListSalaryComponentsQueryDto, "search" | "type" | "isActive">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.salaryComponent.findMany({
      where,
      orderBy: { name: "asc" },
      take: EXPORT_ROW_LIMIT,
      select: { id: true, code: true, name: true, type: true, calculationType: true, value: true, isActive: true },
    });
    return toCsv(rows, ["id", "code", "name", "type", "calculationType", "value", "isActive"]);
  }
}
