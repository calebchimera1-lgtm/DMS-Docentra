import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { CrmLeadStatus } from "@omniflow/database";
import { CreateLeadDto } from "./create-lead.dto";

export class UpdateLeadDto extends PartialType(CreateLeadDto) {
  @ApiPropertyOptional({ enum: CrmLeadStatus })
  @IsOptional()
  @IsEnum(CrmLeadStatus)
  status?: CrmLeadStatus;
}
