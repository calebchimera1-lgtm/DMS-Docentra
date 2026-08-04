import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PERMISSIONS } from "@omniflow/shared";
import type { AttendanceStatus } from "@omniflow/database";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../auth/interfaces/jwt-payload.interface";
import { AttendanceService } from "./attendance.service";
import { ListAttendanceArgs, PaginatedAttendance } from "./graphql/list-attendance.args";
import { toAttendanceItemType } from "./graphql/attendance.mapper";
import { AttendanceItemType } from "./graphql/attendance.type";

@Resolver(() => AttendanceItemType)
@RequirePermissions(PERMISSIONS.ATTENDANCE_READ)
export class AttendanceResolver {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Query(() => PaginatedAttendance, { name: "attendanceRecords" })
  async attendanceRecords(
    @CurrentUser() user: RequestUser,
    @Args() args: ListAttendanceArgs,
  ): Promise<PaginatedAttendance> {
    const result = await this.attendanceService.list(user.companyId, {
      ...args,
      status: args.status as AttendanceStatus | undefined,
    });
    return {
      ...result,
      items: (result.items as Parameters<typeof toAttendanceItemType>[0][]).map(toAttendanceItemType),
    };
  }

  @Query(() => AttendanceItemType, { name: "attendanceRecord" })
  async attendanceRecord(
    @CurrentUser() user: RequestUser,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<AttendanceItemType> {
    const record = await this.attendanceService.findOne(user.companyId, id);
    return toAttendanceItemType(record);
  }
}
