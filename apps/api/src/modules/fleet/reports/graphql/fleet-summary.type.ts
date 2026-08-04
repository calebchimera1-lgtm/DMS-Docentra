import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class FleetSummaryType {
  @Field(() => Int)
  activeCount!: number;

  @Field(() => Int)
  inMaintenanceCount!: number;

  @Field(() => Int)
  retiredCount!: number;

  @Field(() => Int)
  tripsInProgressCount!: number;

  @Field(() => Int)
  totalDistanceAllTime!: number;
}

@ObjectType()
export class VehiclesByStatusType {
  @Field()
  status!: string;

  @Field(() => Int)
  count!: number;
}
