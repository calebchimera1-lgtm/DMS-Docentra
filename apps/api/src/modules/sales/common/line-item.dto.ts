import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsUUID, Min, MaxLength, MinLength } from "class-validator";

export class LineItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description!: string;

  @ApiProperty({ default: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ description: "Unit price in cents" })
  @IsInt()
  @Min(0)
  unitPriceCents!: number;
}

export interface PricedLineItem {
  productId?: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export function priceLineItems(items: LineItemDto[]): { items: PricedLineItem[]; subtotalCents: number } {
  const priced = items.map((item) => ({
    ...item,
    totalCents: item.quantity * item.unitPriceCents,
  }));
  const subtotalCents = priced.reduce((sum, item) => sum + item.totalCents, 0);
  return { items: priced, subtotalCents };
}
