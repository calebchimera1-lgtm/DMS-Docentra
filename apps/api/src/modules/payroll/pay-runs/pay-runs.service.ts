import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CreatePayRunDto } from "./dto/create-pay-run.dto";
import type { ListPayRunsQueryDto } from "./dto/list-pay-runs-query.dto";
import type { UpdatePayRunDto } from "./dto/update-pay-run.dto";

const EXPORT_ROW_LIMIT = 5000;

interface PayslipLineItem {
  componentId?: string;
  name: string;
  type: "EARNING" | "DEDUCTION";
  amountCents: number;
}

const BASIS_POINTS_DIVISOR = 10_000;

@Injectable()
export class PayRunsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, query: ListPayRunsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = { companyId, deletedAt: null, ...(query.status ? { status: query.status } : {}) };

    const [items, total] = await Promise.all([
      this.prisma.payRun.findMany({
        where,
        include: { _count: { select: { payslips: true } } },
        orderBy: { periodStart: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payRun.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const payRun = await this.prisma.payRun.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { _count: { select: { payslips: true } } },
    });
    if (!payRun) {
      throw new NotFoundException("Pay run not found");
    }
    return payRun;
  }

  async create(companyId: string, userId: string, dto: CreatePayRunDto) {
    if (new Date(dto.periodEnd) < new Date(dto.periodStart)) {
      throw new BadRequestException("Period end cannot be before period start");
    }
    return this.prisma.payRun.create({
      data: {
        companyId,
        createdById: userId,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : undefined,
      },
      include: { _count: { select: { payslips: true } } },
    });
  }

  async update(companyId: string, id: string, dto: UpdatePayRunDto) {
    const existing = await this.findOne(companyId, id);
    if (existing.status !== "DRAFT") {
      throw new BadRequestException("Only a draft pay run can be edited");
    }
    return this.prisma.payRun.update({
      where: { id },
      data: {
        periodStart: dto.periodStart ? new Date(dto.periodStart) : undefined,
        periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : undefined,
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : undefined,
      },
      include: { _count: { select: { payslips: true } } },
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    const existing = await this.findOne(companyId, id);
    if (existing.status !== "DRAFT") {
      throw new ForbiddenException("Only a draft pay run can be deleted");
    }
    await this.prisma.payRun.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /**
   * Computes and creates one Payslip per active, salaried employee. A real
   * side effect (unlike a plain status update), the same reasoning behind
   * PurchaseOrder's dedicated `receive` action.
   */
  async generate(companyId: string, id: string) {
    const payRun = await this.findOne(companyId, id);
    if (payRun.status !== "DRAFT") {
      throw new BadRequestException("Only a draft pay run can be generated");
    }

    const [employees, components] = await Promise.all([
      this.prisma.employee.findMany({
        where: { companyId, deletedAt: null, status: "ACTIVE", salaryCents: { not: null } },
      }),
      this.prisma.salaryComponent.findMany({ where: { companyId, deletedAt: null, isActive: true } }),
    ]);

    if (employees.length === 0) {
      throw new BadRequestException("No active employees with a salary set to generate payslips for");
    }

    return this.prisma.$transaction(async (tx) => {
      for (const employee of employees) {
        const basicSalaryCents = employee.salaryCents!;
        const items: PayslipLineItem[] = [];
        let earningsCents = 0;
        let deductionsCents = 0;

        for (const component of components) {
          const amountCents =
            component.calculationType === "PERCENTAGE"
              ? Math.round((basicSalaryCents * component.value) / BASIS_POINTS_DIVISOR)
              : component.value;

          items.push({ componentId: component.id, name: component.name, type: component.type, amountCents });
          if (component.type === "EARNING") {
            earningsCents += amountCents;
          } else {
            deductionsCents += amountCents;
          }
        }

        const grossPayCents = basicSalaryCents + earningsCents;
        const netPayCents = grossPayCents - deductionsCents;

        await tx.payslip.create({
          data: {
            companyId,
            payRunId: payRun.id,
            employeeId: employee.id,
            basicSalaryCents,
            grossPayCents,
            deductionsCents,
            netPayCents,
            currency: employee.currency,
            items: items as unknown as object,
          },
        });
      }

      return tx.payRun.update({
        where: { id: payRun.id },
        data: { status: "PROCESSED" },
        include: { _count: { select: { payslips: true } } },
      });
    });
  }

  async markPaid(companyId: string, id: string) {
    const payRun = await this.findOne(companyId, id);
    if (payRun.status !== "PROCESSED") {
      throw new BadRequestException("Only a processed pay run can be marked paid");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.payslip.updateMany({
        where: { payRunId: payRun.id },
        data: { status: "PAID", paidAt: new Date() },
      });
      return tx.payRun.update({
        where: { id: payRun.id },
        data: { status: "PAID" },
        include: { _count: { select: { payslips: true } } },
      });
    });
  }

  async cancel(companyId: string, id: string) {
    const payRun = await this.findOne(companyId, id);
    if (payRun.status !== "DRAFT" && payRun.status !== "PROCESSED") {
      throw new BadRequestException("Only a draft or processed pay run can be cancelled");
    }
    return this.prisma.payRun.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: { _count: { select: { payslips: true } } },
    });
  }

  async exportCsv(companyId: string, query: Pick<ListPayRunsQueryDto, "status">): Promise<string> {
    const where = { companyId, deletedAt: null, ...(query.status ? { status: query.status } : {}) };
    const rows = await this.prisma.payRun.findMany({
      where,
      include: { _count: { select: { payslips: true } } },
      orderBy: { periodStart: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      paymentDate: r.paymentDate ?? "",
      status: r.status,
      payslipCount: r._count.payslips,
    }));
    return toCsv(flat, ["periodStart", "periodEnd", "paymentDate", "status", "payslipCount"]);
  }
}
