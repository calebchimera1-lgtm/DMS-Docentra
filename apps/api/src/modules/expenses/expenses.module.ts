import { Module } from "@nestjs/common";
import { ExpenseCategoriesController } from "./expense-categories/expense-categories.controller";
import { ExpenseCategoriesResolver } from "./expense-categories/expense-categories.resolver";
import { ExpenseCategoriesService } from "./expense-categories/expense-categories.service";
import { ExpenseClaimsController } from "./expense-claims/expense-claims.controller";
import { ExpenseClaimsResolver } from "./expense-claims/expense-claims.resolver";
import { ExpenseClaimsService } from "./expense-claims/expense-claims.service";
import { ExpensesReportsController } from "./reports/expenses-reports.controller";
import { ExpensesReportsResolver } from "./reports/expenses-reports.resolver";
import { ExpensesReportsService } from "./reports/expenses-reports.service";

@Module({
  // Sibling literal sub-paths under "expenses" (categories, claims, reports)
  // — no controller claims the bare "expenses" root, so there's no ":id"
  // wildcard for any of them to shadow (same collision-avoidance-by-
  // construction as every business module since Projects).
  controllers: [ExpenseCategoriesController, ExpenseClaimsController, ExpensesReportsController],
  providers: [
    ExpenseCategoriesService,
    ExpenseCategoriesResolver,
    ExpenseClaimsService,
    ExpenseClaimsResolver,
    ExpensesReportsService,
    ExpensesReportsResolver,
  ],
})
export class ExpensesModule {}
