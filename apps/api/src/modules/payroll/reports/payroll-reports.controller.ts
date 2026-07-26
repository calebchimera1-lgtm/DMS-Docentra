import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { PayrollReportsService } from "./payroll-reports.service";

@ApiTags("payroll-reports")
@ApiBearerAuth()
@Controller("payroll/reports")
@RequirePermissions(PERMISSIONS.PAYROLL_READ)
export class PayrollReportsController {
  constructor(private readonly reportsService: PayrollReportsService) {}

  @Get("summary")
  @ApiOperation({ summary: "Top-line payroll stats for the module dashboard" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Get("payslips-by-status")
  @ApiOperation({ summary: "Payslip counts grouped by status" })
  payslipsByStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.payslipsByStatus(user.companyId);
  }
}
