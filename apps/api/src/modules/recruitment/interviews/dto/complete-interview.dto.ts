import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class CompleteInterviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;

  @ApiPropertyOptional({ description: "1-5" })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}
