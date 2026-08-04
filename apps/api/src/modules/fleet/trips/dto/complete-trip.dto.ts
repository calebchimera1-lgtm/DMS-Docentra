import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

export class CompleteTripDto {
  @ApiProperty({ description: "The odometer reading at the end of the trip" })
  @IsInt()
  @Min(0)
  endOdometer!: number;
}
