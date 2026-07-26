import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, MaxLength, MinLength } from "class-validator";
import { CalculationType, SalaryComponentType } from "@omniflow/database";

export class CreateSalaryComponentDto {
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

  @ApiProperty({ enum: SalaryComponentType })
  @IsEnum(SalaryComponentType)
  type!: SalaryComponentType;

  @ApiPropertyOptional({ enum: CalculationType, default: CalculationType.FIXED })
  @IsOptional()
  @IsEnum(CalculationType)
  calculationType?: CalculationType;

  @ApiProperty({ description: "Cents if FIXED, basis points (1000 = 10.00%) if PERCENTAGE" })
  @IsInt()
  @Min(0)
  value!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
