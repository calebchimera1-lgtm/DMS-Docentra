import { Module } from "@nestjs/common";
import { JobsModule } from "../../jobs/jobs.module";
import { PluginEventBridgeService } from "./plugin-event-bridge.service";
import { PluginsController } from "./plugins.controller";
import { PluginsService } from "./plugins.service";

@Module({
  imports: [JobsModule],
  controllers: [PluginsController],
  providers: [PluginsService, PluginEventBridgeService],
  exports: [PluginsService],
})
export class PluginsModule {}
