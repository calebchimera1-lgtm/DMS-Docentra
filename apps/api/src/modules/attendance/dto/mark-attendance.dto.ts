import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { AttendanceStatus } from "@omniflow/database";

export class MarkAttendanceDto {
  @ApiProperty()
  @IsUUID()
  employeeId!: string;

  @ApiProperty()
  @IsDateString()
  date!: string;

  @ApiProperty({ enum: AttendanceStatus, description: "ABSENT, ON_LEAVE, or HALF_DAY" })
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
