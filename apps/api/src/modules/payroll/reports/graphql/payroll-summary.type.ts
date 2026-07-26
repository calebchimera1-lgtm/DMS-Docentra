import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class PayrollSummaryType {
  @Field(() => Int)
  eligibleEmployeeCount!: number;

  @Field(() => Int)
  draftPayRunCount!: number;

  @Field(() => Int)
  processedPayRunCount!: number;

  @Field(() => Int)
  totalNetPayPaidCents!: number;
}

@ObjectType()
export class PayslipsByStatusType {
  @Field()
  status!: string;

  @Field(() => Int)
  count!: number;
}
