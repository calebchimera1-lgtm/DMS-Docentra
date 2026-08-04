import { Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { ListPayslipsQueryDto } from "./dto/list-payslips-query.dto";

const EXPORT_ROW_LIMIT = 5000;

const payslipInclude = {
  employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
  payRun: { select: { id: true, periodStart: true, periodEnd: true, status: true } },
} as const;

@Injectable()
export class PayslipsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListPayslipsQueryDto, "payRunId" | "employeeId" | "status">) {
    return {
      companyId,
      ...(query.payRunId ? { payRunId: query.payRunId } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
  }

  async list(companyId: string, query: ListPayslipsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.payslip.findMany({
        where,
        include: payslipInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payslip.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const payslip = await this.prisma.payslip.findFirst({
      where: { id, companyId },
      include: payslipInclude,
    });
    if (!payslip) {
      throw new NotFoundException("Payslip not found");
    }
    return payslip;
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListPayslipsQueryDto, "payRunId" | "employeeId" | "status">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.payslip.findMany({
      where,
      include: payslipInclude,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      employeeNumber: r.employee.employeeNumber,
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
      basicSalaryCents: r.basicSalaryCents,
      grossPayCents: r.grossPayCents,
      deductionsCents: r.deductionsCents,
      netPayCents: r.netPayCents,
      status: r.status,
    }));
    return toCsv(flat, [
      "employeeNumber",
      "employeeName",
      "basicSalaryCents",
      "grossPayCents",
      "deductionsCents",
      "netPayCents",
      "status",
    ]);
  }
}
