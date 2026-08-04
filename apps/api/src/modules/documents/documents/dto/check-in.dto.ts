import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class CheckInDto {
  @ApiProperty({ description: "File name of the new version" })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  fileName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  mimeType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;

  @ApiPropertyOptional({ description: "Object key in S3-compatible storage" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  storageKey?: string;

  @ApiPropertyOptional({ description: "What changed in this revision" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
