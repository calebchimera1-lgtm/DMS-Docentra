import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateDepartmentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code!: string;

  @ApiPropertyOptional({ description: "Employee ID of the department manager" })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
