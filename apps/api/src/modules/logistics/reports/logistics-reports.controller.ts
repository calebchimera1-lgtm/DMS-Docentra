import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { LogisticsReportsService } from "./logistics-reports.service";

@ApiTags("logistics-reports")
@ApiBearerAuth()
@Controller("logistics/reports")
export class LogisticsReportsController {
  constructor(private readonly reportsService: LogisticsReportsService) {}

  @Get("summary")
  @RequirePermissions(PERMISSIONS.LOGISTICS_READ)
  @ApiOperation({ summary: "Shipment counts by stage plus the delivered rate across finished attempts" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Get("by-status")
  @RequirePermissions(PERMISSIONS.LOGISTICS_READ)
  @ApiOperation({ summary: "Shipment counts grouped by status" })
  byStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.byStatus(user.companyId);
  }
}
