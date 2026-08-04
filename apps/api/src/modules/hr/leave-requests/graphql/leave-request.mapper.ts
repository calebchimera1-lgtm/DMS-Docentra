import type { LeaveRequestItemType } from "./leave-request.type";

interface PrismaLeaveRequestWithRelations {
  id: string;
  type: string;
  startDate: Date;
  endDate: Date;
  status: string;
  reason: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  employee: { id: string; employeeNumber: string; firstName: string; lastName: string };
  approver: { id: string; employeeNumber: string; firstName: string; lastName: string } | null;
}

export function toLeaveRequestItemType(leaveRequest: PrismaLeaveRequestWithRelations): LeaveRequestItemType {
  return {
    id: leaveRequest.id,
    type: leaveRequest.type,
    startDate: leaveRequest.startDate,
    endDate: leaveRequest.endDate,
    status: leaveRequest.status,
    reason: leaveRequest.reason ?? undefined,
    reviewedAt: leaveRequest.reviewedAt ?? undefined,
    employee: leaveRequest.employee,
    approver: leaveRequest.approver ?? undefined,
    createdAt: leaveRequest.createdAt,
  };
}
