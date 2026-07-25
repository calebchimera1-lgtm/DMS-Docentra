import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export class CreateTimeEntryDto {
  @ApiProperty()
  @IsUUID()
  taskId!: string;

  @ApiProperty({ description: "Time logged, in minutes" })
  @IsInt()
  @Min(1)
  @Max(1440)
  minutes!: number;

  @ApiProperty()
  @IsDateString()
  entryDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  billable?: boolean;
}
