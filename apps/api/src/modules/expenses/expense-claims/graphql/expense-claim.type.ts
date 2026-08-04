import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class ExpenseClaimEmployeeRef {
  @Field(() => ID)
  id!: string;

  @Field()
  employeeNumber!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;
}

@ObjectType()
export class ExpenseClaimLineType {
  @Field(() => ID)
  categoryId!: string;

  @Field()
  categoryName!: string;

  @Field()
  description!: string;

  @Field(() => Int)
  amountCents!: number;
}

@ObjectType()
export class ExpenseClaimItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  claimNumber!: string;

  @Field()
  expenseDate!: Date;

  @Field(() => [ExpenseClaimLineType])
  items!: ExpenseClaimLineType[];

  @Field(() => Int)
  totalCents!: number;

  @Field()
  currency!: string;

  @Field()
  status!: string;

  @Field(() => ExpenseClaimEmployeeRef)
  employee!: ExpenseClaimEmployeeRef;
}
