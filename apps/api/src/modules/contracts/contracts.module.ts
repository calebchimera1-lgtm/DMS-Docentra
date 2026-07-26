import { Module } from "@nestjs/common";
import { ContractsController } from "./contracts.controller";
import { ContractsResolver } from "./contracts.resolver";
import { ContractsService } from "./contracts.service";
import { ContractsReportsController } from "./reports/contracts-reports.controller";
import { ContractsReportsResolver } from "./reports/contracts-reports.resolver";
import { ContractsReportsService } from "./reports/contracts-reports.service";

@Module({
  // ContractsReportsController ("contracts/reports/*", 3 path segments)
  // is registered before ContractsController (whose "contracts/:id" is a
  // 2-segment wildcard) — belt-and-suspenders, since a 3-segment path can
  // never actually match a 2-segment wildcard, but registration order
  // still follows the same literal-before-wildcard discipline established
  // after the Projects routing bug.
  controllers: [ContractsReportsController, ContractsController],
  providers: [ContractsService, ContractsResolver, ContractsReportsService, ContractsReportsResolver],
})
export class ContractsModule {}
