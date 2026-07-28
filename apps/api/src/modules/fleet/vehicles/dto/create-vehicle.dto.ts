import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from "class-validator";

export class CreateVehicleDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  registrationNumber!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  make!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  model!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1900)
  year?: number;

  @ApiPropertyOptional({ description: "Starting odometer reading", default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  odometerReading?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  fuelType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedDriverId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
