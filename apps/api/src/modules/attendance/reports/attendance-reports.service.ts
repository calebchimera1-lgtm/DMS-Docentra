import { Injectable } from "@nestjs/common";
import type { AttendanceStatus } from "@omniflow/database";
import { PrismaService } from "../../../prisma/prisma.service";

const ATTENDANCE_STATUSES: AttendanceStatus[] = ["PRESENT", "LATE", "HALF_DAY", "ABSENT", "ON_LEAVE"];

function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

@Injectable()
export class AttendanceReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** A day-scoped snapshot (today), the operationally relevant view for attendance. */
  async summary(companyId: string) {
    const date = startOfToday();
    const [presentCount, lateCount, absentCount, onLeaveCount, activeEmployeeCount] = await Promise.all([
      this.prisma.attendanceRecord.count({ where: { companyId, deletedAt: null, date, status: "PRESENT" } }),
      this.prisma.attendanceRecord.count({ where: { companyId, deletedAt: null, date, status: "LATE" } }),
      this.prisma.attendanceRecord.count({ where: { companyId, deletedAt: null, date, status: "ABSENT" } }),
      this.prisma.attendanceRecord.count({ where: { companyId, deletedAt: null, date, status: "ON_LEAVE" } }),
      this.prisma.employee.count({ where: { companyId, deletedAt: null, status: "ACTIVE" } }),
    ]);

    return { presentCount, lateCount, absentCount, onLeaveCount, activeEmployeeCount };
  }

  async byStatus(companyId: string) {
    const date = startOfToday();
    const grouped = await this.prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { companyId, deletedAt: null, date },
      _count: { _all: true },
    });
    const countByStatus = new Map(grouped.map((g) => [g.status, g._count._all]));
    return ATTENDANCE_STATUSES.map((status) => ({ status, count: countByStatus.get(status) ?? 0 }));
  }
}
