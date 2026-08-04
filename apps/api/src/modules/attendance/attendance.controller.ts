import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@omniflow/shared";
import { AuditEntity } from "../../common/decorators/audit-entity.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../auth/interfaces/jwt-payload.interface";
import { AttendanceService } from "./attendance.service";
import { ClockInDto } from "./dto/clock-in.dto";
import { ListAttendanceQueryDto } from "./dto/list-attendance-query.dto";
import { MarkAttendanceDto } from "./dto/mark-attendance.dto";
import { UpdateAttendanceDto } from "./dto/update-attendance.dto";

@ApiTags("attendance")
@ApiBearerAuth()
@Controller("attendance")
@AuditEntity("AttendanceRecord")
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: "List attendance records (paginated, filterable by employee/status/date range)" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListAttendanceQueryDto) {
    return this.attendanceService.list(user.companyId, query);
  }

  @Get("export")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="attendance.csv"')
  @ApiOperation({ summary: "Export attendance records matching the current filters as CSV" })
  exportCsv(@CurrentUser() user: RequestUser, @Query() query: ListAttendanceQueryDto) {
    return this.attendanceService.exportCsv(user.companyId, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
  @ApiOperation({ summary: "Get a single attendance record" })
  findOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.attendanceService.findOne(user.companyId, id);
  }

  @Post("clock-in")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_WRITE)
  @ApiOperation({ summary: "Clock an employee in for today, auto-detecting lateness" })
  clockIn(@CurrentUser() user: RequestUser, @Body() dto: ClockInDto) {
    return this.attendanceService.clockIn(user.companyId, dto);
  }

  @Post(":id/clock-out")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_WRITE)
  @ApiOperation({ summary: "Clock out, computing minutes worked" })
  clockOut(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.attendanceService.clockOut(user.companyId, id);
  }

  @Post("mark")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_WRITE)
  @ApiOperation({ summary: "Mark a day ABSENT, ON_LEAVE, or HALF_DAY without a clock event" })
  mark(@CurrentUser() user: RequestUser, @Body() dto: MarkAttendanceDto) {
    return this.attendanceService.mark(user.companyId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_WRITE)
  @ApiOperation({ summary: "Update an attendance record's note" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateAttendanceDto) {
    return this.attendanceService.update(user.companyId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.ATTENDANCE_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an attendance record" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.attendanceService.remove(user.companyId, id);
  }
}
