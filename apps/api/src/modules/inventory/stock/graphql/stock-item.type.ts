import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class StockProductRef {
  @Field(() => ID)
  id!: string;

  @Field()
  sku!: string;

  @Field()
  name!: string;
}

@ObjectType()
export class StockWarehouseRef {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;
}

@ObjectType()
export class StockItemType {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  quantityOnHand!: number;

  @Field(() => Int)
  reorderPoint!: number;

  @Field(() => Int)
  reorderQuantity!: number;

  @Field(() => StockProductRef)
  product!: StockProductRef;

  @Field(() => StockWarehouseRef)
  warehouse!: StockWarehouseRef;
}
