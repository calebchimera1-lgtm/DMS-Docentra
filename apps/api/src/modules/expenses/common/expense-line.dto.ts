import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, IsUUID, Min, MaxLength, MinLength } from "class-validator";

export class ExpenseLineDto {
  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description!: string;

  @ApiProperty({ description: "Amount in cents" })
  @IsInt()
  @Min(1)
  amountCents!: number;
}

export interface SnapshottedExpenseLine {
  categoryId: string;
  categoryName: string;
  description: string;
  amountCents: number;
}
