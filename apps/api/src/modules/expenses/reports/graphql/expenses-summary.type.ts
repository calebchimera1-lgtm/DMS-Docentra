import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class ExpensesSummaryType {
  @Field(() => Int)
  draftClaimCount!: number;

  @Field(() => Int)
  submittedClaimCount!: number;

  @Field(() => Int)
  approvedUnpaidClaimCount!: number;

  @Field(() => Int)
  totalPaidCents!: number;
}

@ObjectType()
export class ExpenseClaimsByStatusType {
  @Field()
  status!: string;

  @Field(() => Int)
  count!: number;
}

@ObjectType()
export class ExpensesByCategoryType {
  @Field()
  categoryName!: string;

  @Field(() => Int)
  totalCents!: number;
}
