import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class FailShipmentDto {
  @ApiProperty({ description: "Why the delivery could not be completed" })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  failureReason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string;
}
