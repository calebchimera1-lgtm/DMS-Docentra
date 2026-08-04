import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { LineItemType } from "../../../sales/common/graphql/line-item.type";

@ObjectType()
export class PurchaseOrderSupplierRef {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;
}

@ObjectType()
export class PurchaseOrderWarehouseRef {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;
}

@ObjectType()
export class PurchaseOrderItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  orderNumber!: string;

  @Field()
  status!: string;

  @Field(() => [LineItemType])
  items!: LineItemType[];

  @Field(() => Int)
  subtotalCents!: number;

  @Field(() => Int)
  totalCents!: number;

  @Field()
  currency!: string;

  @Field({ nullable: true })
  expectedDate?: Date;

  @Field(() => PurchaseOrderSupplierRef)
  supplier!: PurchaseOrderSupplierRef;

  @Field(() => PurchaseOrderWarehouseRef, { nullable: true })
  warehouse?: PurchaseOrderWarehouseRef;

  @Field()
  createdAt!: Date;
}
