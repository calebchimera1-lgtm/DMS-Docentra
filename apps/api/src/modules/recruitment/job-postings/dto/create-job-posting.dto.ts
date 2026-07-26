import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MaxLength, MinLength } from "class-validator";
import { EmploymentType } from "@omniflow/database";

export class CreateJobPostingDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ enum: EmploymentType, default: "FULL_TIME" })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  openings?: number;
}
