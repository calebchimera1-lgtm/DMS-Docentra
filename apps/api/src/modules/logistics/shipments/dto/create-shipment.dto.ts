import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { LineItemDto } from "../../../sales/common/line-item.dto";

export class CreateShipmentDto {
  @ApiProperty({ description: "Warehouse the goods ship from" })
  @IsUUID()
  warehouseId!: string;

  @ApiPropertyOptional({ description: "Sales order this shipment fulfils" })
  @IsOptional()
  @IsUUID()
  salesOrderId?: string;

  @ApiPropertyOptional({ description: "Customer account receiving the goods" })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({ description: "Vehicle assigned to carry the shipment" })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({ description: "Defaults to the vehicle's assigned driver on dispatch" })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiProperty({ type: [LineItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  items!: LineItemDto[];

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  destinationAddress!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
