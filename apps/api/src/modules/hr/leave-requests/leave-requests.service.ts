import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import { DomainEvents } from "../../../common/events/domain-events";
import type { CreateLeaveRequestDto } from "./dto/create-leave-request.dto";
import type { ListLeaveRequestsQueryDto } from "./dto/list-leave-requests-query.dto";

const EXPORT_ROW_LIMIT = 5000;

const leaveRequestInclude = {
  employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
  approver: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  private buildWhere(companyId: string, query: Pick<ListLeaveRequestsQueryDto, "status" | "type" | "employeeId">) {
    return {
      companyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    };
  }

  private async resolveCurrentEmployee(companyId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({ where: { companyId, userId, deletedAt: null } });
    if (!employee) {
      throw new ForbiddenException("Only users with a linked employee profile can approve or reject leave requests");
    }
    return employee;
  }

  async list(companyId: string, query: ListLeaveRequestsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        include: leaveRequestInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const leaveRequest = await this.prisma.leaveRequest.findFirst({
      where: { id, companyId },
      include: leaveRequestInclude,
    });
    if (!leaveRequest) {
      throw new NotFoundException("Leave request not found");
    }
    return leaveRequest;
  }

  async create(companyId: string, dto: CreateLeaveRequestDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, companyId, deletedAt: null },
    });
    if (!employee) {
      throw new BadRequestException("Employee does not belong to this company");
    }
    if (new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException("End date cannot be before start date");
    }

    return this.prisma.leaveRequest.create({
      data: {
        companyId,
        employeeId: dto.employeeId,
        type: dto.type,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        reason: dto.reason,
      },
      include: leaveRequestInclude,
    });
  }

  async approve(companyId: string, currentUserId: string, id: string) {
    const leaveRequest = await this.findOne(companyId, id);
    if (leaveRequest.status !== "PENDING") {
      throw new BadRequestException("Only a pending leave request can be approved");
    }
    const approver = await this.resolveCurrentEmployee(companyId, currentUserId);
    const reviewed = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: "APPROVED", approverId: approver.id, reviewedAt: new Date() },
      include: leaveRequestInclude,
    });
    this.events.emit(DomainEvents.LEAVE_REQUEST_REVIEWED, {
      companyId,
      leaveRequestId: reviewed.id,
      employeeId: reviewed.employeeId,
      status: "APPROVED",
    });
    return reviewed;
  }

  async reject(companyId: string, currentUserId: string, id: string) {
    const leaveRequest = await this.findOne(companyId, id);
    if (leaveRequest.status !== "PENDING") {
      throw new BadRequestException("Only a pending leave request can be rejected");
    }
    const approver = await this.resolveCurrentEmployee(companyId, currentUserId);
    const reviewed = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: "REJECTED", approverId: approver.id, reviewedAt: new Date() },
      include: leaveRequestInclude,
    });
    this.events.emit(DomainEvents.LEAVE_REQUEST_REVIEWED, {
      companyId,
      leaveRequestId: reviewed.id,
      employeeId: reviewed.employeeId,
      status: "REJECTED",
    });
    return reviewed;
  }

  async cancel(companyId: string, id: string) {
    const leaveRequest = await this.findOne(companyId, id);
    if (leaveRequest.status !== "PENDING") {
      throw new BadRequestException("Only a pending leave request can be cancelled");
    }
    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: leaveRequestInclude,
    });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListLeaveRequestsQueryDto, "status" | "type" | "employeeId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.leaveRequest.findMany({
      where,
      include: leaveRequestInclude,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      employeeNumber: r.employee.employeeNumber,
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
      type: r.type,
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status,
    }));
    return toCsv(flat, ["employeeNumber", "employeeName", "type", "startDate", "endDate", "status"]);
  }
}
