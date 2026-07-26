import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class WorkOrderBomRef {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;
}

@ObjectType()
export class WorkOrderProductRef {
  @Field(() => ID)
  id!: string;

  @Field()
  sku!: string;

  @Field()
  name!: string;
}

@ObjectType()
export class WorkOrderWarehouseRef {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;
}

@ObjectType()
export class WorkOrderItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  workOrderNumber!: string;

  @Field(() => Int)
  quantity!: number;

  @Field()
  status!: string;

  @Field(() => WorkOrderBomRef)
  bom!: WorkOrderBomRef;

  @Field(() => WorkOrderProductRef)
  product!: WorkOrderProductRef;

  @Field(() => WorkOrderWarehouseRef)
  warehouse!: WorkOrderWarehouseRef;
}
