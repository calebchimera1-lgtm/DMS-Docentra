import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class VoidSaleDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  voidReason!: string;
}
