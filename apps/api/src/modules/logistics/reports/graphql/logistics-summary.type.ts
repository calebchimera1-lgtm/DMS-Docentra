import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class LogisticsSummaryType {
  @Field(() => Int)
  draftCount!: number;

  @Field(() => Int)
  inFlightCount!: number;

  @Field(() => Int)
  deliveredCount!: number;

  @Field(() => Int)
  failedCount!: number;

  @Field(() => Int)
  totalCount!: number;

  @Field(() => Int)
  deliveredRatePercent!: number;
}

@ObjectType()
export class ShipmentsByStatusType {
  @Field()
  status!: string;

  @Field(() => Int)
  count!: number;
}
