import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { toCsv } from "../../common/utils/csv.util";
import type { ClockInDto } from "./dto/clock-in.dto";
import type { ListAttendanceQueryDto } from "./dto/list-attendance-query.dto";
import type { MarkAttendanceDto } from "./dto/mark-attendance.dto";
import type { UpdateAttendanceDto } from "./dto/update-attendance.dto";

const EXPORT_ROW_LIMIT = 5000;

/** An employee clocking in after this hour (server time) is marked LATE. */
const LATE_CUTOFF_HOUR = 9;

const attendanceInclude = {
  employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
} as const;

function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfDay(dateString: string): Date {
  const d = new Date(dateString);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(
    companyId: string,
    query: Pick<ListAttendanceQueryDto, "employeeId" | "status" | "dateFrom" | "dateTo">,
  ) {
    return {
      companyId,
      deletedAt: null,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            date: {
              ...(query.dateFrom ? { gte: startOfDay(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: startOfDay(query.dateTo) } : {}),
            },
          }
        : {}),
    };
  }

  private async assertEmployeeBelongsToCompany(companyId: string, employeeId: string): Promise<void> {
    const count = await this.prisma.employee.count({ where: { id: employeeId, companyId, deletedAt: null } });
    if (count === 0) {
      throw new BadRequestException("Employee does not belong to this company");
    }
  }

  async list(companyId: string, query: ListAttendanceQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where,
        include: attendanceInclude,
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.attendanceRecord.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const record = await this.prisma.attendanceRecord.findFirst({
      where: { id, companyId, deletedAt: null },
      include: attendanceInclude,
    });
    if (!record) {
      throw new NotFoundException("Attendance record not found");
    }
    return record;
  }

  /**
   * Upserts today's record and stamps clockInAt, auto-detecting LATE
   * against a fixed cutoff hour — the same "hardcoded business-rule
   * constant" convention as Contracts' 30-day expiring-soon window.
   */
  async clockIn(companyId: string, dto: ClockInDto) {
    await this.assertEmployeeBelongsToCompany(companyId, dto.employeeId);
    const date = startOfToday();

    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: dto.employeeId, date } },
    });
    if (existing?.clockInAt) {
      throw new BadRequestException("This employee has already clocked in today");
    }

    const now = new Date();
    const status = now.getUTCHours() >= LATE_CUTOFF_HOUR ? "LATE" : "PRESENT";

    return this.prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId: dto.employeeId, date } },
      create: { companyId, employeeId: dto.employeeId, date, clockInAt: now, status },
      update: { clockInAt: now, status, clockOutAt: null, workedMinutes: null },
      include: attendanceInclude,
    });
  }

  async clockOut(companyId: string, id: string) {
    const record = await this.findOne(companyId, id);
    if (!record.clockInAt) {
      throw new BadRequestException("Cannot clock out before clocking in");
    }
    if (record.clockOutAt) {
      throw new BadRequestException("This attendance record has already been clocked out");
    }

    const now = new Date();
    const workedMinutes = Math.round((now.getTime() - record.clockInAt.getTime()) / 60_000);

    return this.prisma.attendanceRecord.update({
      where: { id },
      data: { clockOutAt: now, workedMinutes },
      include: attendanceInclude,
    });
  }

  /** Sets a day's status directly, for days with no clock event (a no-show, an approved leave day). */
  async mark(companyId: string, dto: MarkAttendanceDto) {
    if (dto.status === "PRESENT" || dto.status === "LATE") {
      throw new BadRequestException("Use clock-in to record a present or late day");
    }
    await this.assertEmployeeBelongsToCompany(companyId, dto.employeeId);
    const date = startOfDay(dto.date);

    return this.prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId: dto.employeeId, date } },
      create: { companyId, employeeId: dto.employeeId, date, status: dto.status, note: dto.note },
      update: { status: dto.status, note: dto.note, clockInAt: null, clockOutAt: null, workedMinutes: null },
      include: attendanceInclude,
    });
  }

  async update(companyId: string, id: string, dto: UpdateAttendanceDto) {
    await this.findOne(companyId, id);
    return this.prisma.attendanceRecord.update({
      where: { id },
      data: { note: dto.note },
      include: attendanceInclude,
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.findOne(companyId, id);
    await this.prisma.attendanceRecord.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListAttendanceQueryDto, "employeeId" | "status" | "dateFrom" | "dateTo">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.attendanceRecord.findMany({
      where,
      include: attendanceInclude,
      orderBy: { date: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      employeeNumber: r.employee.employeeNumber,
      employee: `${r.employee.firstName} ${r.employee.lastName}`,
      date: r.date,
      clockInAt: r.clockInAt ?? "",
      clockOutAt: r.clockOutAt ?? "",
      status: r.status,
      workedMinutes: r.workedMinutes ?? "",
    }));
    return toCsv(flat, ["employeeNumber", "employee", "date", "clockInAt", "clockOutAt", "status", "workedMinutes"]);
  }
}
