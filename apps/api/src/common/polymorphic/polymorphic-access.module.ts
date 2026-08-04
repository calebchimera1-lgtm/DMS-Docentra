import { Global, Module } from "@nestjs/common";
import { PolymorphicAccessService } from "./polymorphic-access.service";

@Global()
@Module({
  providers: [PolymorphicAccessService],
  exports: [PolymorphicAccessService],
})
export class PolymorphicAccessModule {}
