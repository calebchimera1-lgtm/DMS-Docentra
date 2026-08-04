import { Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/interfaces/jwt-payload.interface";
import { AttendanceReportsService } from "./attendance-reports.service";
import { AttendanceByStatusType, AttendanceSummaryType } from "./graphql/attendance-summary.type";

@Resolver()
@RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
export class AttendanceReportsResolver {
  constructor(private readonly reportsService: AttendanceReportsService) {}

  @Query(() => AttendanceSummaryType, { name: "attendanceSummary" })
  summary(@CurrentUser() user: RequestUser) {
    return this.reportsService.summary(user.companyId);
  }

  @Query(() => [AttendanceByStatusType], { name: "attendanceByStatus" })
  byStatus(@CurrentUser() user: RequestUser) {
    return this.reportsService.byStatus(user.companyId);
  }
}
