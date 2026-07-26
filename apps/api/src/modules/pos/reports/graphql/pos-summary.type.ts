import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class PosSummaryType {
  @Field(() => Int)
  openSessionCount!: number;

  @Field(() => Int)
  completedSaleCount!: number;

  @Field(() => Int)
  voidedCount!: number;

  @Field(() => Int)
  refundedCount!: number;

  @Field(() => Int)
  totalSalesValueCents!: number;
}

@ObjectType()
export class PosSalesByPaymentMethodType {
  @Field()
  paymentMethod!: string;

  @Field(() => Int)
  count!: number;

  @Field(() => Int)
  totalCents!: number;
}
