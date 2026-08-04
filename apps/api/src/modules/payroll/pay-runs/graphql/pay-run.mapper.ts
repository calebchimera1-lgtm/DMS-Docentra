import type { PayRunItemType } from "./pay-run.type";

interface PrismaPayRunWithCount {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  paymentDate: Date | null;
  status: string;
  createdAt: Date;
  _count: { payslips: number };
}

export function toPayRunItemType(payRun: PrismaPayRunWithCount): PayRunItemType {
  return {
    id: payRun.id,
    periodStart: payRun.periodStart,
    periodEnd: payRun.periodEnd,
    paymentDate: payRun.paymentDate ?? undefined,
    status: payRun.status,
    payslipCount: payRun._count.payslips,
    createdAt: payRun.createdAt,
  };
}
