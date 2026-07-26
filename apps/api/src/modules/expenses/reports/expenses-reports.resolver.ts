import { Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ExpensesReportsService } from "./expenses-reports.service";
import { ExpenseClaimsByStatusType, ExpensesByCategoryType, ExpensesSummaryType } from "./graphql/expenses-summary.type";

@Resolver()
@RequirePermissions(PERMISSIONS.EXPENSES_READ)
export class ExpensesReportsResolver {
  constructor(private readonly reportsService: ExpensesReportsService) {}

  @Query(() => ExpensesSummaryType, { name: "expensesSummary" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Query(() => [ExpenseClaimsByStatusType], { name: "expenseClaimsByStatus" })
  claimsByStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.claimsByStatus(user.companyId);
  }

  @Query(() => [ExpensesByCategoryType], { name: "expensesByCategory" })
  spendByCategory(@CurrentUser() user: RequestUser) {
    return this.reportsService.spendByCategory(user.companyId);
  }
}
