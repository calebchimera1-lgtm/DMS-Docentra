import { Module } from "@nestjs/common";
import { ShipmentsController } from "./shipments/shipments.controller";
import { ShipmentsResolver } from "./shipments/shipments.resolver";
import { ShipmentsService } from "./shipments/shipments.service";
import { LogisticsReportsController } from "./reports/logistics-reports.controller";
import { LogisticsReportsResolver } from "./reports/logistics-reports.resolver";
import { LogisticsReportsService } from "./reports/logistics-reports.service";

@Module({
  // Sibling literal sub-paths under "logistics" (shipments, reports) — no
  // controller claims the bare "logistics" root, so there's no ":id" wildcard
  // for either to shadow (same collision-avoidance-by-construction as every
  // module since Projects). Reports is registered first regardless, as
  // belt-and-suspenders.
  controllers: [LogisticsReportsController, ShipmentsController],
  providers: [ShipmentsService, ShipmentsResolver, LogisticsReportsService, LogisticsReportsResolver],
})
export class LogisticsModule {}
