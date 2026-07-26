import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { AttendanceReportsService } from "./attendance-reports.service";

@ApiTags("attendance-reports")
@ApiBearerAuth()
@Controller("attendance/reports")
export class AttendanceReportsController {
  constructor(private readonly reportsService: AttendanceReportsService) {}

  @Get("summary")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: "Today's present/late/absent/on-leave counts and active employee count" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Get("by-status")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: "Today's attendance record counts grouped by status" })
  byStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.byStatus(user.companyId);
  }
}
