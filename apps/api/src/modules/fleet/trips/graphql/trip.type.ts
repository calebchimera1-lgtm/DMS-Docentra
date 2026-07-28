import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class TripVehicleRef {
  @Field(() => ID)
  id!: string;

  @Field()
  registrationNumber!: string;
}

@ObjectType()
export class TripDriverRef {
  @Field(() => ID)
  id!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;
}

@ObjectType()
export class TripItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  status!: string;

  @Field(() => Int)
  startOdometer!: number;

  @Field(() => Int, { nullable: true })
  endOdometer?: number;

  @Field(() => Int, { nullable: true })
  distance?: number;

  @Field(() => TripVehicleRef)
  vehicle!: TripVehicleRef;

  @Field(() => TripDriverRef, { nullable: true })
  driver?: TripDriverRef;
}
