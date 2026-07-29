import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";

export class BillSubscriptionDto {
  @ApiPropertyOptional({ description: "Due date for the generated invoice; defaults to the period end" })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
