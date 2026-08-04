import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class ApproveExpenseClaimDto {
  @ApiProperty({ description: "Liability ledger account to credit, e.g. Employee Reimbursements Payable" })
  @IsUUID()
  creditAccountId!: string;
}
