import type { PayslipItemType } from "./payslip.type";

interface PrismaPayslipWithRelations {
  id: string;
  basicSalaryCents: number;
  grossPayCents: number;
  deductionsCents: number;
  netPayCents: number;
  currency: string;
  status: string;
  employee: { id: string; employeeNumber: string; firstName: string; lastName: string };
  payRun: { id: string; periodStart: Date; periodEnd: Date; status: string };
}

export function toPayslipItemType(payslip: PrismaPayslipWithRelations): PayslipItemType {
  return {
    id: payslip.id,
    basicSalaryCents: payslip.basicSalaryCents,
    grossPayCents: payslip.grossPayCents,
    deductionsCents: payslip.deductionsCents,
    netPayCents: payslip.netPayCents,
    currency: payslip.currency,
    status: payslip.status,
    employee: payslip.employee,
    payRun: payslip.payRun,
  };
}
