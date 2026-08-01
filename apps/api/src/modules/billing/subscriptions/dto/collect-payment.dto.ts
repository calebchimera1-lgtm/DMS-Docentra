import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class CollectPaymentDto {
  @ApiPropertyOptional({ default: "manual", description: "Payment provider key to collect through." })
  @IsOptional()
  @IsString()
  provider?: string;
}
