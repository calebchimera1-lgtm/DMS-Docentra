import { Module } from "@nestjs/common";
import { SalaryComponentsController } from "./salary-components/salary-components.controller";
import { SalaryComponentsResolver } from "./salary-components/salary-components.resolver";
import { SalaryComponentsService } from "./salary-components/salary-components.service";
import { PayRunsController } from "./pay-runs/pay-runs.controller";
import { PayRunsResolver } from "./pay-runs/pay-runs.resolver";
import { PayRunsService } from "./pay-runs/pay-runs.service";
import { PayslipsController } from "./payslips/payslips.controller";
import { PayslipsResolver } from "./payslips/payslips.resolver";
import { PayslipsService } from "./payslips/payslips.service";
import { PayrollReportsController } from "./reports/payroll-reports.controller";
import { PayrollReportsResolver } from "./reports/payroll-reports.resolver";
import { PayrollReportsService } from "./reports/payroll-reports.service";

@Module({
  // Sibling literal sub-paths under "payroll" (salary-components, pay-runs,
  // payslips, reports) — no controller claims the bare "payroll" root, so
  // there's no ":id" wildcard for any of them to shadow (same
  // collision-avoidance-by-construction as Support and Purchase).
  controllers: [
    SalaryComponentsController,
    PayRunsController,
    PayslipsController,
    PayrollReportsController,
  ],
  providers: [
    SalaryComponentsService,
    SalaryComponentsResolver,
    PayRunsService,
    PayRunsResolver,
    PayslipsService,
    PayslipsResolver,
    PayrollReportsService,
    PayrollReportsResolver,
  ],
})
export class PayrollModule {}
