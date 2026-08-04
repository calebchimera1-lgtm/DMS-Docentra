import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class MaintenanceVehicleRef {
  @Field(() => ID)
  id!: string;

  @Field()
  registrationNumber!: string;
}

@ObjectType()
export class MaintenanceItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  type!: string;

  @Field()
  status!: string;

  @Field()
  scheduledDate!: Date;

  @Field(() => Int, { nullable: true })
  costCents?: number;

  @Field(() => MaintenanceVehicleRef)
  vehicle!: MaintenanceVehicleRef;
}
