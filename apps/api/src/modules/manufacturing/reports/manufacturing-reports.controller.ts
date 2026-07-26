import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ManufacturingReportsService } from "./manufacturing-reports.service";

@ApiTags("manufacturing-reports")
@ApiBearerAuth()
@Controller("manufacturing/reports")
export class ManufacturingReportsController {
  constructor(private readonly reportsService: ManufacturingReportsService) {}

  @Get("summary")
  @RequirePermissions(PERMISSIONS.MANUFACTURING_READ)
  @ApiOperation({ summary: "Work order counts by lifecycle stage, active BOM count, and total completed quantity" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Get("by-status")
  @RequirePermissions(PERMISSIONS.MANUFACTURING_READ)
  @ApiOperation({ summary: "Work order counts grouped by status" })
  byStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.byStatus(user.companyId);
  }
}
