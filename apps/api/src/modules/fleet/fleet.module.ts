import { Module } from "@nestjs/common";
import { VehiclesController } from "./vehicles/vehicles.controller";
import { VehiclesResolver } from "./vehicles/vehicles.resolver";
import { VehiclesService } from "./vehicles/vehicles.service";
import { TripsController } from "./trips/trips.controller";
import { TripsResolver } from "./trips/trips.resolver";
import { TripsService } from "./trips/trips.service";
import { MaintenanceController } from "./maintenance/maintenance.controller";
import { MaintenanceResolver } from "./maintenance/maintenance.resolver";
import { MaintenanceService } from "./maintenance/maintenance.service";
import { FleetReportsController } from "./reports/fleet-reports.controller";
import { FleetReportsResolver } from "./reports/fleet-reports.resolver";
import { FleetReportsService } from "./reports/fleet-reports.service";

@Module({
  // Sibling literal sub-paths under "fleet" (vehicles, trips, maintenance,
  // reports) — no controller claims the bare "fleet" root, so there's no
  // ":id" wildcard for any of them to shadow (same
  // collision-avoidance-by-construction as every module since Projects).
  controllers: [VehiclesController, TripsController, MaintenanceController, FleetReportsController],
  providers: [
    VehiclesService,
    VehiclesResolver,
    TripsService,
    TripsResolver,
    MaintenanceService,
    MaintenanceResolver,
    FleetReportsService,
    FleetReportsResolver,
  ],
})
export class FleetModule {}
