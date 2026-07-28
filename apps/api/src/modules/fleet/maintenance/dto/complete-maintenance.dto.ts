import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, Min } from "class-validator";

export class CompleteMaintenanceDto {
  @ApiPropertyOptional({ description: "Actual cost in cents" })
  @IsOptional()
  @IsInt()
  @Min(0)
  costCents?: number;
}
