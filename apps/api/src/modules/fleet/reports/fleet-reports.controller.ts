import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { FleetReportsService } from "./fleet-reports.service";

@ApiTags("fleet-reports")
@ApiBearerAuth()
@Controller("fleet/reports")
export class FleetReportsController {
  constructor(private readonly reportsService: FleetReportsService) {}

  @Get("summary")
  @RequirePermissions(PERMISSIONS.FLEET_READ)
  @ApiOperation({ summary: "Vehicle status counts, trips in progress, and total distance all-time" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Get("by-status")
  @RequirePermissions(PERMISSIONS.FLEET_READ)
  @ApiOperation({ summary: "Vehicle counts grouped by status" })
  byStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.byStatus(user.companyId);
  }
}
