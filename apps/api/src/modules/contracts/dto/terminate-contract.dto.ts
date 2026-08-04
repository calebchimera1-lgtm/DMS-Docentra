import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class TerminateContractDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  terminationReason!: string;
}
