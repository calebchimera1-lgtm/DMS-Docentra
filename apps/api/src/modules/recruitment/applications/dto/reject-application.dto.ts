import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class RejectApplicationDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  rejectionReason!: string;
}
