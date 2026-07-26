import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsInt, IsOptional, Min } from "class-validator";

export class RenewContractDto {
  @ApiProperty({ description: "The new term's end date" })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ description: "Defaults to the expiring contract's value" })
  @IsOptional()
  @IsInt()
  @Min(0)
  valueCents?: number;
}
