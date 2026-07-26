import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { JobPostingStatus } from "@omniflow/database";

export class ListJobPostingsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional({ description: "Matches against the title" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: JobPostingStatus })
  @IsOptional()
  @IsEnum(JobPostingStatus)
  status?: JobPostingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
