import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator";
import { LineItemDto } from "../../common/line-item.dto";

export class CreateSalesOrderDto {
  @ApiProperty()
  @IsUUID()
  accountId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @ApiProperty({ type: [LineItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  items!: LineItemDto[];

  @ApiPropertyOptional({ default: "USD" })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;
}
