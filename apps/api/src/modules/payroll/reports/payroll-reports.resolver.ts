import { Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { PayrollReportsService } from "./payroll-reports.service";
import { PayrollSummaryType, PayslipsByStatusType } from "./graphql/payroll-summary.type";

@Resolver()
@RequirePermissions(PERMISSIONS.PAYROLL_READ)
export class PayrollReportsResolver {
  constructor(private readonly reportsService: PayrollReportsService) {}

  @Query(() => PayrollSummaryType, { name: "payrollSummary" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Query(() => [PayslipsByStatusType], { name: "payslipsByStatus" })
  payslipsByStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.payslipsByStatus(user.companyId);
  }
}
