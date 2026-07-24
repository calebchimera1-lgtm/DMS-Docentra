import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { StockProductRef, StockWarehouseRef } from "../../stock/graphql/stock-item.type";

@ObjectType()
export class StockMovementItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  type!: string;

  @Field(() => Int)
  quantity!: number;

  @Field({ nullable: true })
  reference?: string;

  @Field(() => StockProductRef)
  product!: StockProductRef;

  @Field(() => StockWarehouseRef)
  warehouse!: StockWarehouseRef;

  @Field()
  createdAt!: Date;
}
