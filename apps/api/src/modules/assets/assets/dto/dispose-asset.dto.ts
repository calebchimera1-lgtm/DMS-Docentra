import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsInt, IsOptional, IsUUID, Min } from "class-validator";

export class DisposeAssetDto {
  @ApiProperty()
  @IsDateString()
  disposalDate!: string;

  @ApiPropertyOptional({ description: "Cash/proceeds received in cents, default 0" })
  @IsOptional()
  @IsInt()
  @Min(0)
  disposalProceedsCents?: number;

  @ApiPropertyOptional({ description: "Account proceeds land in — required when disposalProceedsCents > 0" })
  @IsOptional()
  @IsUUID()
  cashAccountId?: string;

  @ApiProperty({ description: "Account any gain or loss on disposal posts to" })
  @IsUUID()
  gainLossAccountId!: string;
}
