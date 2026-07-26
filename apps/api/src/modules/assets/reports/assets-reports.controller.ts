import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { AssetsReportsService } from "./assets-reports.service";

@ApiTags("assets-reports")
@ApiBearerAuth()
@Controller("assets/reports")
@RequirePermissions(PERMISSIONS.ASSETS_READ)
export class AssetsReportsController {
  constructor(private readonly reportsService: AssetsReportsService) {}

  @Get("summary")
  @ApiOperation({ summary: "Top-line asset stats for the module dashboard" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Get("by-category")
  @ApiOperation({ summary: "Active asset count and net book value grouped by category" })
  byCategory(@CurrentUser() user: RequestUser) {
    return this.reportsService.byCategory(user.companyId);
  }
}
