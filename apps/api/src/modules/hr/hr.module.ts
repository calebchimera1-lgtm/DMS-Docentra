import { Module } from "@nestjs/common";
import { DepartmentsController } from "./departments/departments.controller";
import { DepartmentsResolver } from "./departments/departments.resolver";
import { DepartmentsService } from "./departments/departments.service";
import { EmployeesController } from "./employees/employees.controller";
import { EmployeesResolver } from "./employees/employees.resolver";
import { EmployeesService } from "./employees/employees.service";
import { LeaveRequestsController } from "./leave-requests/leave-requests.controller";
import { LeaveRequestsResolver } from "./leave-requests/leave-requests.resolver";
import { LeaveRequestsService } from "./leave-requests/leave-requests.service";
import { HrReportsController } from "./reports/hr-reports.controller";
import { HrReportsResolver } from "./reports/hr-reports.resolver";
import { HrReportsService } from "./reports/hr-reports.service";

@Module({
  controllers: [
    DepartmentsController,
    EmployeesController,
    LeaveRequestsController,
    HrReportsController,
  ],
  providers: [
    DepartmentsService,
    DepartmentsResolver,
    EmployeesService,
    EmployeesResolver,
    LeaveRequestsService,
    LeaveRequestsResolver,
    HrReportsService,
    HrReportsResolver,
  ],
})
export class HrModule {}
