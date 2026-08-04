import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CreateDepartmentDto } from "./dto/create-department.dto";
import type { ListDepartmentsQueryDto } from "./dto/list-departments-query.dto";
import type { UpdateDepartmentDto } from "./dto/update-department.dto";

const EXPORT_ROW_LIMIT = 5000;

const departmentInclude = {
  manager: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListDepartmentsQueryDto, "search" | "isActive">) {
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

  private async assertManagerBelongsToCompany(companyId: string, managerId: string): Promise<void> {
    const manager = await this.prisma.employee.findFirst({ where: { id: managerId, companyId, deletedAt: null } });
    if (!manager) {
      throw new BadRequestException("Manager does not belong to this company");
    }
  }

  async list(companyId: string, query: ListDepartmentsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        include: departmentInclude,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.department.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, companyId, deletedAt: null },
      include: departmentInclude,
    });
    if (!department) {
      throw new NotFoundException("Department not found");
    }
    return department;
  }

  async create(companyId: string, dto: CreateDepartmentDto) {
    const existing = await this.prisma.department.findFirst({
      where: { companyId, code: dto.code, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException("A department with this code already exists");
    }
    if (dto.managerId) {
      await this.assertManagerBelongsToCompany(companyId, dto.managerId);
    }
    return this.prisma.department.create({ data: { companyId, ...dto }, include: departmentInclude });
  }

  async update(companyId: string, id: string, dto: UpdateDepartmentDto) {
    await this.findOne(companyId, id);
    if (dto.code) {
      const existing = await this.prisma.department.findFirst({
        where: { companyId, code: dto.code, deletedAt: null, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException("A department with this code already exists");
      }
    }
    if (dto.managerId) {
      await this.assertManagerBelongsToCompany(companyId, dto.managerId);
    }
    return this.prisma.department.update({ where: { id }, data: dto, include: departmentInclude });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.findOne(companyId, id);
    const employeeCount = await this.prisma.employee.count({
      where: { departmentId: id, deletedAt: null },
    });
    if (employeeCount > 0) {
      throw new ForbiddenException("Cannot delete a department that still has employees assigned to it");
    }
    await this.prisma.department.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListDepartmentsQueryDto, "search" | "isActive">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.department.findMany({
      where,
      orderBy: { name: "asc" },
      take: EXPORT_ROW_LIMIT,
      select: { id: true, code: true, name: true, isActive: true },
    });
    return toCsv(rows, ["id", "code", "name", "isActive"]);
  }
}
