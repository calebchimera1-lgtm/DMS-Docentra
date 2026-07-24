import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MaxLength } from "class-validator";
import { PaymentMethod } from "@omniflow/database";

export class CreatePaymentDto {
  @ApiProperty({ description: "Amount in cents" })
  @IsInt()
  @Min(1)
  amountCents!: number;

  @ApiPropertyOptional({ default: "USD" })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ enum: PaymentMethod, default: "BANK_TRANSFER" })
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @ApiProperty()
  @IsDateString()
  paymentDate!: string;

  @ApiProperty({ description: "Ledger account money lands in/leaves from, e.g. Bank" })
  @IsUUID()
  debitAccountId!: string;

  @ApiProperty({ description: "Ledger account being settled, e.g. Accounts Receivable" })
  @IsUUID()
  creditAccountId!: string;

  @ApiPropertyOptional({ description: "A Sales invoice this payment settles — marks it PAID" })
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
