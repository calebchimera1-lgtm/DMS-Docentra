import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardResolver } from "./dashboard.resolver";
import { DashboardService } from "./dashboard.service";

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, DashboardResolver],
})
export class DashboardModule {}
