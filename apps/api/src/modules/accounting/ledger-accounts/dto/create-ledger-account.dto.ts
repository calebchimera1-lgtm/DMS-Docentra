import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { LedgerAccountType } from "@omniflow/database";

export class CreateLedgerAccountDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ enum: LedgerAccountType })
  @IsEnum(LedgerAccountType)
  type!: LedgerAccountType;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
