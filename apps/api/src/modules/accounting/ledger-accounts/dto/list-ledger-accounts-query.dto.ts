import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { LedgerAccountType } from "@omniflow/database";

export class ListLedgerAccountsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional({ description: "Matches against code or name" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: LedgerAccountType })
  @IsOptional()
  @IsEnum(LedgerAccountType)
  type?: LedgerAccountType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
