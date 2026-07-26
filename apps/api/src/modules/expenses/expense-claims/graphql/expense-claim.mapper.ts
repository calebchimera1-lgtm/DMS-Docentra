import type { SnapshottedExpenseLine } from "../../common/expense-line.dto";
import type { ExpenseClaimItemType } from "./expense-claim.type";

interface PrismaExpenseClaimWithRelations {
  id: string;
  claimNumber: string;
  expenseDate: Date;
  items: unknown;
  totalCents: number;
  currency: string;
  status: string;
  employee: { id: string; employeeNumber: string; firstName: string; lastName: string };
}

export function toExpenseClaimItemType(claim: PrismaExpenseClaimWithRelations): ExpenseClaimItemType {
  return {
    id: claim.id,
    claimNumber: claim.claimNumber,
    expenseDate: claim.expenseDate,
    items: claim.items as unknown as SnapshottedExpenseLine[],
    totalCents: claim.totalCents,
    currency: claim.currency,
    status: claim.status,
    employee: claim.employee,
  };
}
