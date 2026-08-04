import type { AttendanceItemType } from "./attendance.type";

interface PrismaAttendanceWithRelations {
  id: string;
  date: Date;
  clockInAt: Date | null;
  clockOutAt: Date | null;
  status: string;
  workedMinutes: number | null;
  employee: { id: string; employeeNumber: string; firstName: string; lastName: string };
}

export function toAttendanceItemType(record: PrismaAttendanceWithRelations): AttendanceItemType {
  return {
    id: record.id,
    date: record.date,
    clockInAt: record.clockInAt ?? undefined,
    clockOutAt: record.clockOutAt ?? undefined,
    status: record.status,
    workedMinutes: record.workedMinutes ?? undefined,
    employee: record.employee,
  };
}
