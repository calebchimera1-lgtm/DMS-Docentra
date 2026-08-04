import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class CreateWorkOrderDto {
  @ApiProperty({ description: "The BillOfMaterial recipe to produce against" })
  @IsUUID()
  bomId!: string;

  @ApiProperty({ description: "Where components are consumed from and finished goods are produced into" })
  @IsUUID()
  warehouseId!: string;

  @ApiProperty({ description: "Planned quantity of the finished product to produce" })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  plannedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
