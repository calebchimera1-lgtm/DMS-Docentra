import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../auth/interfaces/jwt-payload.interface";
import { DashboardService } from "./dashboard.service";

@ApiTags("dashboard")
@ApiBearerAuth()
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  @ApiOperation({ summary: "Headline counts for the current company (branches, users, notifications)" })
  getSummary(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getSummary(user.companyId);
  }

  @Get("activity-by-action")
  @RequirePermissions(PERMISSIONS.AUDIT_LOGS_READ)
  @ApiOperation({ summary: "Audit log activity grouped by action, last N days (default 30)" })
  getActivityByAction(@CurrentUser() user: RequestUser, @Query("days") days?: string) {
    return this.dashboardService.getActivityByAction(user.companyId, days ? Number(days) : undefined);
  }

  @Get("recent-activity")
  @RequirePermissions(PERMISSIONS.AUDIT_LOGS_READ)
  @ApiOperation({ summary: "Most recent audit log entries for the current company" })
  getRecentActivity(@CurrentUser() user: RequestUser, @Query("limit") limit?: string) {
    return this.dashboardService.getRecentActivity(user.companyId, limit ? Number(limit) : undefined);
  }
}
