import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, NotEquals } from "class-validator";
import { StockMovementType } from "@omniflow/database";

export class CreateMovementDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty()
  @IsUUID()
  warehouseId!: string;

  @ApiProperty({ enum: StockMovementType })
  @IsEnum(StockMovementType)
  type!: StockMovementType;

  @ApiProperty({
    description:
      "Positive quantity for RECEIPT/RETURN/TRANSFER_IN/SALE/TRANSFER_OUT (direction is implied by type); " +
      "for ADJUSTMENT, a signed delta (positive or negative).",
  })
  @IsInt()
  @NotEquals(0)
  quantity!: number;

  @ApiPropertyOptional({ description: "Free-text reference, e.g. a sales order or PO number" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
