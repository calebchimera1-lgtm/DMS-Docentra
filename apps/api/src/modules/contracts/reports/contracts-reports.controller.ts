import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { ContractsReportsService } from "./contracts-reports.service";

@ApiTags("contracts-reports")
@ApiBearerAuth()
// "contracts/reports/*" is a 3-segment path, so it can never collide with
// ContractsController's 2-segment "contracts/:id" wildcard regardless of
// registration order — safe to nest under the module prefix, unlike the
// Projects bug where "projects/tasks" and "projects/:id" were both exactly
// 2 segments.
@Controller("contracts/reports")
@RequirePermissions(PERMISSIONS.CONTRACTS_READ)
export class ContractsReportsController {
  constructor(private readonly reportsService: ContractsReportsService) {}

  @Get("summary")
  @ApiOperation({ summary: "Top-line contract stats for the module dashboard" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Get("by-status")
  @ApiOperation({ summary: "Contract counts grouped by status" })
  byStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.byStatus(user.companyId);
  }
}
