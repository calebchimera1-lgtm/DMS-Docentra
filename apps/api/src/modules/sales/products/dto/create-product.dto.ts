import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, Min, MaxLength, MinLength } from "class-validator";

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  sku!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ description: "Unit price in cents", default: 0 })
  @IsInt()
  @Min(0)
  unitPriceCents!: number;

  @ApiPropertyOptional({ default: "USD" })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
