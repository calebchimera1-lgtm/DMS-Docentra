import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import { formatDocumentNumber } from "../../sales/common/document-number.util";
import type { CreateEmployeeDto } from "./dto/create-employee.dto";
import type { ListEmployeesQueryDto } from "./dto/list-employees-query.dto";
import type { UpdateEmployeeDto } from "./dto/update-employee.dto";

const EXPORT_ROW_LIMIT = 5000;

const employeeInclude = {
  department: { select: { id: true, name: true, code: true } },
  manager: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListEmployeesQueryDto, "search" | "status" | "employmentType" | "departmentId">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" as const } },
              { lastName: { contains: query.search, mode: "insensitive" as const } },
              { email: { contains: query.search, mode: "insensitive" as const } },
              { employeeNumber: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.employmentType ? { employmentType: query.employmentType } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    };
  }

  private async assertDepartmentBelongsToCompany(companyId: string, departmentId: string): Promise<void> {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, companyId, deletedAt: null },
    });
    if (!department) {
      throw new BadRequestException("Department does not belong to this company");
    }
  }

  private async assertManagerBelongsToCompany(companyId: string, managerId: string, selfId?: string): Promise<void> {
    if (managerId === selfId) {
      throw new BadRequestException("An employee cannot be their own manager");
    }
    const manager = await this.prisma.employee.findFirst({ where: { id: managerId, companyId, deletedAt: null } });
    if (!manager) {
      throw new BadRequestException("Manager does not belong to this company");
    }
  }

  private async assertUserLinkable(companyId: string, userId: string, selfId?: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, companyId, deletedAt: null } });
    if (!user) {
      throw new BadRequestException("User does not belong to this company");
    }
    const existingProfile = await this.prisma.employee.findFirst({
      where: { userId, deletedAt: null, ...(selfId ? { NOT: { id: selfId } } : {}) },
    });
    if (existingProfile) {
      throw new ConflictException("This user account is already linked to another employee");
    }
  }

  async list(companyId: string, query: ListEmployeesQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        include: employeeInclude,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, companyId, deletedAt: null },
      include: employeeInclude,
    });
    if (!employee) {
      throw new NotFoundException("Employee not found");
    }
    return employee;
  }

  async create(companyId: string, dto: CreateEmployeeDto) {
    if (dto.departmentId) {
      await this.assertDepartmentBelongsToCompany(companyId, dto.departmentId);
    }
    if (dto.managerId) {
      await this.assertManagerBelongsToCompany(companyId, dto.managerId);
    }
    if (dto.userId) {
      await this.assertUserLinkable(companyId, dto.userId);
    }

    const count = await this.prisma.employee.count({ where: { companyId } });
    return this.prisma.employee.create({
      data: {
        companyId,
        employeeNumber: formatDocumentNumber("EMP", count),
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        jobTitle: dto.jobTitle,
        employmentType: dto.employmentType,
        hireDate: new Date(dto.hireDate),
        salaryCents: dto.salaryCents,
        currency: dto.currency,
        departmentId: dto.departmentId,
        managerId: dto.managerId,
        userId: dto.userId,
      },
      include: employeeInclude,
    });
  }

  async update(companyId: string, id: string, dto: UpdateEmployeeDto) {
    await this.findOne(companyId, id);
    if (dto.departmentId) {
      await this.assertDepartmentBelongsToCompany(companyId, dto.departmentId);
    }
    if (dto.managerId) {
      await this.assertManagerBelongsToCompany(companyId, dto.managerId, id);
    }
    if (dto.userId) {
      await this.assertUserLinkable(companyId, dto.userId, id);
    }

    return this.prisma.employee.update({
      where: { id },
      data: {
        ...dto,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
      },
      include: employeeInclude,
    });
  }

  async terminate(companyId: string, id: string) {
    const employee = await this.findOne(companyId, id);
    if (employee.status === "TERMINATED") {
      throw new BadRequestException("Employee is already terminated");
    }
    return this.prisma.employee.update({
      where: { id },
      data: { status: "TERMINATED", terminationDate: new Date() },
      include: employeeInclude,
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.findOne(companyId, id);
    const [directReportCount, managedDepartmentCount] = await Promise.all([
      this.prisma.employee.count({ where: { managerId: id, deletedAt: null } }),
      this.prisma.department.count({ where: { managerId: id, deletedAt: null } }),
    ]);
    if (directReportCount > 0 || managedDepartmentCount > 0) {
      throw new ForbiddenException(
        "Cannot delete an employee who still manages other employees or a department — reassign them first",
      );
    }
    await this.prisma.employee.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListEmployeesQueryDto, "search" | "status" | "employmentType" | "departmentId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.employee.findMany({
      where,
      include: employeeInclude,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      employeeNumber: r.employeeNumber,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email ?? "",
      department: r.department?.name ?? "",
      jobTitle: r.jobTitle ?? "",
      employmentType: r.employmentType,
      status: r.status,
      hireDate: r.hireDate,
    }));
    return toCsv(flat, [
      "employeeNumber",
      "firstName",
      "lastName",
      "email",
      "department",
      "jobTitle",
      "employmentType",
      "status",
      "hireDate",
    ]);
  }
}
