import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { CrmDealStage } from "@omniflow/database";
import { CreateDealDto } from "./create-deal.dto";

export class UpdateDealDto extends PartialType(CreateDealDto) {
  @ApiPropertyOptional({ enum: CrmDealStage })
  @IsOptional()
  @IsEnum(CrmDealStage)
  stage?: CrmDealStage;
}
