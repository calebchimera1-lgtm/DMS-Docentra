import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsUUID, Min, ValidateNested } from "class-validator";
import { PaymentMethod } from "@omniflow/database";
import { LineItemDto } from "../../../sales/common/line-item.dto";

export class CreateSaleDto {
  @ApiProperty({ description: "The open register session to record this sale against" })
  @IsUUID()
  sessionId!: string;

  @ApiPropertyOptional({ description: "Optional CRM account; omit for a walk-in customer" })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiProperty({ type: [LineItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  items!: LineItemDto[];

  @ApiPropertyOptional({ enum: PaymentMethod, default: "CASH" })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: "Cash handed over by the customer, in cents (required for CASH payments)" })
  @IsOptional()
  @IsInt()
  @Min(0)
  amountTenderedCents?: number;
}
