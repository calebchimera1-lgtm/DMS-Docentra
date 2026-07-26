import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { PurchaseOrderStatus } from "@omniflow/database";
import { CreatePurchaseOrderDto } from "./create-purchase-order.dto";

export class UpdatePurchaseOrderDto extends PartialType(CreatePurchaseOrderDto) {
  @ApiPropertyOptional({ enum: PurchaseOrderStatus, description: "DRAFT -> SENT -> CONFIRMED, or CANCELLED" })
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;
}
