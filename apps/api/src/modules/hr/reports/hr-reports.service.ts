import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class HrReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(companyId: string) {
    const [activeEmployeeCount, totalEmployeeCount, onLeaveCount, departmentCount, pendingLeaveRequestCount] =
      await Promise.all([
        this.prisma.employee.count({ where: { companyId, deletedAt: null, status: "ACTIVE" } }),
        this.prisma.employee.count({ where: { companyId, deletedAt: null } }),
        this.prisma.employee.count({ where: { companyId, deletedAt: null, status: "ON_LEAVE" } }),
        this.prisma.department.count({ where: { companyId, deletedAt: null, isActive: true } }),
        this.prisma.leaveRequest.count({ where: { companyId, status: "PENDING" } }),
      ]);

    return {
      activeEmployeeCount,
      totalEmployeeCount,
      onLeaveCount,
      departmentCount,
      pendingLeaveRequestCount,
    };
  }

  /** Headcount of non-terminated employees grouped by department, plus an "Unassigned" bucket. */
  async headcountByDepartment(companyId: string) {
    const [departments, grouped] = await Promise.all([
      this.prisma.department.findMany({
        where: { companyId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.employee.groupBy({
        by: ["departmentId"],
        where: { companyId, deletedAt: null, status: { not: "TERMINATED" } },
        _count: { _all: true },
      }),
    ]);

    const countByDepartmentId = new Map<string | null, number>();
    for (const row of grouped) {
      countByDepartmentId.set(row.departmentId, row._count._all);
    }

    const rows = departments.map((department) => ({
      departmentId: department.id,
      departmentName: department.name,
      employeeCount: countByDepartmentId.get(department.id) ?? 0,
    }));

    const unassignedCount = countByDepartmentId.get(null) ?? 0;
    if (unassignedCount > 0) {
      rows.push({ departmentId: undefined as unknown as string, departmentName: "Unassigned", employeeCount: unassignedCount });
    }

    return rows;
  }
}
