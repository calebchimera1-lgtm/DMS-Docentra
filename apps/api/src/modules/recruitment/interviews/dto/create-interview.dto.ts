import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateInterviewDto {
  @ApiProperty()
  @IsUUID()
  applicationId!: string;

  @ApiProperty({ description: "e.g. Phone Screen, Technical, Onsite" })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  stage!: string;

  @ApiProperty()
  @IsDateString()
  scheduledAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  interviewerId?: string;
}
