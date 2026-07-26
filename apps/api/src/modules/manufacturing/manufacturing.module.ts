import { Module } from "@nestjs/common";
import { BomsController } from "./boms/boms.controller";
import { BomsResolver } from "./boms/boms.resolver";
import { BomsService } from "./boms/boms.service";
import { WorkOrdersController } from "./work-orders/work-orders.controller";
import { WorkOrdersResolver } from "./work-orders/work-orders.resolver";
import { WorkOrdersService } from "./work-orders/work-orders.service";
import { ManufacturingReportsController } from "./reports/manufacturing-reports.controller";
import { ManufacturingReportsResolver } from "./reports/manufacturing-reports.resolver";
import { ManufacturingReportsService } from "./reports/manufacturing-reports.service";

@Module({
  // Sibling literal sub-paths under "manufacturing" (boms, work-orders,
  // reports) — no controller claims the bare "manufacturing" root, so
  // there's no ":id" wildcard for any of them to shadow (same
  // collision-avoidance-by-construction as every module since Projects).
  controllers: [BomsController, WorkOrdersController, ManufacturingReportsController],
  providers: [
    BomsService,
    BomsResolver,
    WorkOrdersService,
    WorkOrdersResolver,
    ManufacturingReportsService,
    ManufacturingReportsResolver,
  ],
})
export class ManufacturingModule {}
