import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

export class FulfillOrderDto {
  @ApiPropertyOptional({
    description: "Warehouse to deduct stock from. Required unless the order already has one set.",
  })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}
