import { Module } from "@nestjs/common";
import { BranchesController } from "./branches.controller";
import { BranchesResolver } from "./branches.resolver";
import { BranchesService } from "./branches.service";

@Module({
  controllers: [BranchesController],
  providers: [BranchesService, BranchesResolver],
  exports: [BranchesService],
})
export class BranchesModule {}
