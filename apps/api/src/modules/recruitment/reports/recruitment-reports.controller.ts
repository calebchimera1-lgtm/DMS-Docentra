import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { RecruitmentReportsService } from "./recruitment-reports.service";

@ApiTags("recruitment-reports")
@ApiBearerAuth()
@Controller("recruitment/reports")
@RequirePermissions(PERMISSIONS.RECRUITMENT_READ)
export class RecruitmentReportsController {
  constructor(private readonly reportsService: RecruitmentReportsService) {}

  @Get("summary")
  @ApiOperation({ summary: "Top-line recruitment stats for the module dashboard" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Get("applications-by-status")
  @ApiOperation({ summary: "Application counts grouped by pipeline status" })
  applicationsByStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.applicationsByStatus(user.companyId);
  }
}
