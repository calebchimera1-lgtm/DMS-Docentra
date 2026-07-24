import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { AccountingReportsService } from "./accounting-reports.service";

@ApiTags("accounting-reports")
@ApiBearerAuth()
@Controller("accounting/reports")
@RequirePermissions(PERMISSIONS.ACCOUNTING_READ)
export class AccountingReportsController {
  constructor(private readonly reportsService: AccountingReportsService) {}

  @Get("summary")
  @ApiOperation({ summary: "Top-line accounting stats for the module dashboard (assets/liabilities/equity/P&L)" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Get("balances-by-type")
  @ApiOperation({ summary: "Posted debit/credit totals and net balance grouped by ledger account type" })
  balancesByType(@CurrentUser() user: RequestUser) {
    return this.reportsService.balancesByType(user.companyId);
  }
}
