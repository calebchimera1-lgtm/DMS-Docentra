import { Module } from "@nestjs/common";
import { RolesController } from "./roles.controller";
import { RolesResolver } from "./roles.resolver";
import { RolesService } from "./roles.service";

@Module({
  controllers: [RolesController],
  providers: [RolesService, RolesResolver],
  exports: [RolesService],
})
export class RolesModule {}
