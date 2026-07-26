import { ApiProperty } from "@nestjs/swagger";
import { IsDateString } from "class-validator";

export class CreateDepreciationRunDto {
  @ApiProperty({ description: "The period this run posts depreciation for, e.g. a month-end date" })
  @IsDateString()
  periodDate!: string;
}
