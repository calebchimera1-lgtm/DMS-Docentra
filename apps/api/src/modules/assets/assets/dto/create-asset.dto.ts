import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min, MaxLength, MinLength } from "class-validator";

export class CreateAssetDto {
  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty()
  @IsDateString()
  purchaseDate!: string;

  @ApiProperty({ description: "Purchase cost in cents" })
  @IsInt()
  @Min(0)
  purchaseCostCents!: number;

  @ApiPropertyOptional({ description: "Estimated residual value in cents, default 0" })
  @IsOptional()
  @IsInt()
  @Min(0)
  salvageValueCents?: number;

  @ApiPropertyOptional({ description: "Defaults to the category's defaultUsefulLifeMonths" })
  @IsOptional()
  @IsInt()
  @Min(1)
  usefulLifeMonths?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
