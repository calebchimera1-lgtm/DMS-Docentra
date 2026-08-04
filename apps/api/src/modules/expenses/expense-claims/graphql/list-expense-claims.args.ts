import { ArgsType, Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { ExpenseClaimItemType } from "./expense-claim.type";

@ArgsType()
export class ListExpenseClaimsArgs {
  @Field(() => Int, { defaultValue: 1 })
  @IsInt()
  @Min(1)
  page!: number;

  @Field(() => Int, { defaultValue: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}

@ObjectType()
export class PaginatedExpenseClaims {
  @Field(() => [ExpenseClaimItemType])
  items!: ExpenseClaimItemType[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;
}
