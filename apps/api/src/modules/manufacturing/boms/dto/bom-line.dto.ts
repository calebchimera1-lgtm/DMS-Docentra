import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsUUID, Min } from "class-validator";

export class BomLineDto {
  @ApiProperty()
  @IsUUID()
  componentProductId!: string;

  @ApiProperty({ description: "Quantity of this component consumed per one unit of the finished product" })
  @IsInt()
  @Min(1)
  quantity!: number;
}
