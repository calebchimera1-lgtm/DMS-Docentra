import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { CrmReportsService } from "./crm-reports.service";

@ApiTags("crm-reports")
@ApiBearerAuth()
@Controller("crm/reports")
@RequirePermissions(PERMISSIONS.CRM_READ)
export class CrmReportsController {
  constructor(private readonly reportsService: CrmReportsService) {}

  @Get("summary")
  @ApiOperation({ summary: "Top-line CRM stats for the module dashboard" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Get("pipeline")
  @ApiOperation({ summary: "Deal count and value grouped by pipeline stage" })
  pipeline(@CurrentUser() user: RequestUser) {
    return this.reportsService.pipeline(user.companyId);
  }

  @Get("leads-funnel")
  @ApiOperation({ summary: "Lead count grouped by status" })
  leadsFunnel(@CurrentUser() user: RequestUser) {
    return this.reportsService.leadsFunnel(user.companyId);
  }
}
