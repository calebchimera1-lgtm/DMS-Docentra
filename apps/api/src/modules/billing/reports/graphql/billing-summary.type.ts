import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class BillingSummaryType {
  @Field(() => Int)
  trialingCount!: number;

  @Field(() => Int)
  activeCount!: number;

  @Field(() => Int)
  pausedCount!: number;

  @Field(() => Int)
  cancelledCount!: number;

  @Field(() => Int)
  activePlanCount!: number;

  @Field(() => Int)
  mrrCents!: number;

  @Field(() => Int)
  arrCents!: number;

  @Field(() => Int)
  invoicesRaised!: number;

  @Field(() => Int)
  totalBilledCents!: number;
}

@ObjectType()
export class SubscriptionsByStatusType {
  @Field()
  status!: string;

  @Field(() => Int)
  count!: number;
}
