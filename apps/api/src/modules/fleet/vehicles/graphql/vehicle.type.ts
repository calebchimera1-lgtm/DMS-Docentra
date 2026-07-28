import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class VehicleDriverRef {
  @Field(() => ID)
  id!: string;

  @Field()
  employeeNumber!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;
}

@ObjectType()
export class VehicleItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  registrationNumber!: string;

  @Field()
  make!: string;

  @Field()
  model!: string;

  @Field(() => Int, { nullable: true })
  year?: number;

  @Field()
  status!: string;

  @Field(() => Int)
  odometerReading!: number;

  @Field(() => VehicleDriverRef, { nullable: true })
  assignedDriver?: VehicleDriverRef;
}
