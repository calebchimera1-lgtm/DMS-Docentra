import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { BillingInterval } from "@omniflow/database";

export class ListPlansQueryDto {
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

  @ApiPropertyOptional({ description: "Matches against plan code or name" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: BillingInterval })
  @IsOptional()
  @IsEnum(BillingInterval)
  billingInterval?: BillingInterval;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
