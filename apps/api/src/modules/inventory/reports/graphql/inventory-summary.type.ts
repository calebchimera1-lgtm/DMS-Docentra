import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class InventorySummaryType {
  @Field(() => Int)
  warehouseCount!: number;

  @Field(() => Int)
  trackedItemCount!: number;

  @Field(() => Int)
  totalUnitsOnHand!: number;

  @Field(() => Int)
  totalStockValueCents!: number;

  @Field(() => Int)
  lowStockCount!: number;

  @Field(() => Int)
  totalMovementCount!: number;
}
