import { Module } from "@nestjs/common";
import { AttendanceController } from "./attendance.controller";
import { AttendanceResolver } from "./attendance.resolver";
import { AttendanceService } from "./attendance.service";
import { AttendanceReportsController } from "./reports/attendance-reports.controller";
import { AttendanceReportsResolver } from "./reports/attendance-reports.resolver";
import { AttendanceReportsService } from "./reports/attendance-reports.service";

@Module({
  // AttendanceReportsController ("attendance/reports/*", 3 path segments)
  // is registered before AttendanceController (whose "attendance/:id" is a
  // 2-segment wildcard) — belt-and-suspenders, since a 3-segment path can
  // never actually match a 2-segment wildcard, but registration order
  // still follows the same literal-before-wildcard discipline established
  // after the Projects routing bug. Within AttendanceController itself,
  // the literal "export" route is declared before the ":id" wildcard for
  // the same reason.
  controllers: [AttendanceReportsController, AttendanceController],
  providers: [AttendanceService, AttendanceResolver, AttendanceReportsService, AttendanceReportsResolver],
})
export class AttendanceModule {}
