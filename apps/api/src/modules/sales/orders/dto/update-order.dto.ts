import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { SalesOrderStatus } from "@omniflow/database";
import { CreateSalesOrderDto } from "./create-order.dto";

export class UpdateSalesOrderDto extends PartialType(CreateSalesOrderDto) {
  @ApiPropertyOptional({ enum: SalesOrderStatus })
  @IsOptional()
  @IsEnum(SalesOrderStatus)
  status?: SalesOrderStatus;
}
