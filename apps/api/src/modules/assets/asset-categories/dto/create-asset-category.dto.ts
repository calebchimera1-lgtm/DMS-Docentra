import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min, MaxLength, MinLength } from "class-validator";

export class CreateAssetCategoryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code!: string;

  @ApiPropertyOptional({ default: 36 })
  @IsOptional()
  @IsInt()
  @Min(1)
  defaultUsefulLifeMonths?: number;

  @ApiPropertyOptional({ description: "Fixed-asset ledger account, credited on disposal" })
  @IsOptional()
  @IsUUID()
  assetAccountId?: string;

  @ApiPropertyOptional({ description: "Expense account debited each depreciation run" })
  @IsOptional()
  @IsUUID()
  depreciationExpenseAccountId?: string;

  @ApiPropertyOptional({ description: "Contra-asset account credited each depreciation run" })
  @IsOptional()
  @IsUUID()
  accumulatedDepreciationAccountId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
