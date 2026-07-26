import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateExpenseClaimDto } from "./create-expense-claim.dto";

export class UpdateExpenseClaimDto extends PartialType(OmitType(CreateExpenseClaimDto, ["employeeId"] as const)) {}
