import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";
import { BillingInterval } from "@omniflow/database";

export class CreatePlanDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ description: "Price per billing interval, in cents" })
  @IsInt()
  @Min(0)
  priceCents!: number;

  @ApiPropertyOptional({ default: "USD" })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ enum: BillingInterval, default: "MONTHLY" })
  @IsOptional()
  @IsEnum(BillingInterval)
  billingInterval?: BillingInterval;

  @ApiPropertyOptional({ description: "Free trial length in days; 0 for no trial", default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
