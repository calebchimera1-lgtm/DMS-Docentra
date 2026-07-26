import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateApplicationDto {
  @ApiProperty()
  @IsUUID()
  jobPostingId!: string;

  @ApiProperty()
  @IsUUID()
  candidateId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
