import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class ManufacturingSummaryType {
  @Field(() => Int)
  draftCount!: number;

  @Field(() => Int)
  inProgressCount!: number;

  @Field(() => Int)
  completedCount!: number;

  @Field(() => Int)
  activeBomCount!: number;

  @Field(() => Int)
  totalCompletedQuantity!: number;
}

@ObjectType()
export class WorkOrdersByStatusType {
  @Field()
  status!: string;

  @Field(() => Int)
  count!: number;
}
