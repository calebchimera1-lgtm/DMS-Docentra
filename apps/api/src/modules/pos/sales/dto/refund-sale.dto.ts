import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class RefundSaleDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  refundReason!: string;
}
