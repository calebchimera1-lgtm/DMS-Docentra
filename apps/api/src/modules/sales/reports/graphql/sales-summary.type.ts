import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class SalesSummaryType {
  @Field(() => Int)
  productCount!: number;

  @Field(() => Int)
  openQuoteCount!: number;

  @Field(() => Int)
  openOrderCount!: number;

  @Field(() => Int)
  revenueBookedCents!: number;

  @Field(() => Int)
  revenueCollectedCents!: number;

  @Field(() => Int)
  overdueInvoiceCount!: number;
}
