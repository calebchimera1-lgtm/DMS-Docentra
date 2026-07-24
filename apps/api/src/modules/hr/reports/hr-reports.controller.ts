import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { HrReportsService } from "./hr-reports.service";

@ApiTags("hr-reports")
@ApiBearerAuth()
@Controller("hr/reports")
@RequirePermissions(PERMISSIONS.HR_READ)
export class HrReportsController {
  constructor(private readonly reportsService: HrReportsService) {}

  @Get("summary")
  @ApiOperation({ summary: "Top-line HR stats for the module dashboard (headcount, on-leave, pending requests)" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Get("headcount-by-department")
  @ApiOperation({ summary: "Active headcount grouped by department" })
  headcountByDepartment(@CurrentUser() user: RequestUser) {
    return this.reportsService.headcountByDepartment(user.companyId);
  }
}
