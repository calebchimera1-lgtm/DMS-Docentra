import type { ExpenseCategoryItemType } from "./expense-category.type";

interface PrismaExpenseCategory {
  id: string;
  name: string;
  code: string;
  ledgerAccountId: string | null;
  isActive: boolean;
}

export function toExpenseCategoryItemType(category: PrismaExpenseCategory): ExpenseCategoryItemType {
  return {
    id: category.id,
    name: category.name,
    code: category.code,
    ledgerAccountId: category.ledgerAccountId ?? undefined,
    isActive: category.isActive,
  };
}
