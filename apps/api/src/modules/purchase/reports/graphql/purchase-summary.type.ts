import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class PurchaseSummaryType {
  @Field(() => Int)
  supplierCount!: number;

  @Field(() => Int)
  openOrderCount!: number;

  @Field(() => Int)
  committedSpendCents!: number;

  @Field(() => Int)
  receivedOrderCount!: number;
}

@ObjectType()
export class PurchaseOrdersByStatusType {
  @Field()
  status!: string;

  @Field(() => Int)
  count!: number;
}
