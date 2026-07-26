import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

export class CloseSessionDto {
  @ApiProperty({ description: "Cash counted in the drawer at close, in cents" })
  @IsInt()
  @Min(0)
  countedCashCents!: number;
}
