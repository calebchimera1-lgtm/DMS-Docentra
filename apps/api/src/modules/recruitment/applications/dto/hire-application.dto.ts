import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MaxLength } from "class-validator";
import { EmploymentType } from "@omniflow/database";

export class HireApplicationDto {
  @ApiProperty()
  @IsDateString()
  hireDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @ApiPropertyOptional({ enum: EmploymentType, default: EmploymentType.FULL_TIME })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ description: "Annual salary in cents" })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryCents?: number;

  @ApiPropertyOptional({ default: "USD" })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ description: "Defaults to the job posting's department" })
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
