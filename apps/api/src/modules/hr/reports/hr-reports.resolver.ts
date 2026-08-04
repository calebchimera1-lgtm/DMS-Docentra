import { Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { HrReportsService } from "./hr-reports.service";
import { DepartmentHeadcountType, HrSummaryType } from "./graphql/hr-summary.type";

@Resolver()
@RequirePermissions(PERMISSIONS.HR_READ)
export class HrReportsResolver {
  constructor(private readonly reportsService: HrReportsService) {}

  @Query(() => HrSummaryType, { name: "hrSummary" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Query(() => [DepartmentHeadcountType], { name: "hrHeadcountByDepartment" })
  headcountByDepartment(@CurrentUser() user: RequestUser) {
    return this.reportsService.headcountByDepartment(user.companyId);
  }
}
