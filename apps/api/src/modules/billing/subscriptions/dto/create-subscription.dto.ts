import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class CreateSubscriptionDto {
  @ApiProperty({ description: "Customer account being subscribed" })
  @IsUUID()
  accountId!: string;

  @ApiProperty()
  @IsUUID()
  planId!: string;

  @ApiPropertyOptional({ description: "Seats or units; multiplies the plan price", default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ description: "Defaults to now" })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
