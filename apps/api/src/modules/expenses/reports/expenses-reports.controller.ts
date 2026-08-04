import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ExpensesReportsService } from "./expenses-reports.service";

@ApiTags("expenses-reports")
@ApiBearerAuth()
@Controller("expenses/reports")
@RequirePermissions(PERMISSIONS.EXPENSES_READ)
export class ExpensesReportsController {
  constructor(private readonly reportsService: ExpensesReportsService) {}

  @Get("summary")
  @ApiOperation({ summary: "Top-line expense stats for the module dashboard" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Get("claims-by-status")
  @ApiOperation({ summary: "Expense claim counts grouped by status" })
  claimsByStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.claimsByStatus(user.companyId);
  }

  @Get("spend-by-category")
  @ApiOperation({ summary: "Approved/paid spend totals grouped by expense category" })
  spendByCategory(@CurrentUser() user: RequestUser) {
    return this.reportsService.spendByCategory(user.companyId);
  }
}
