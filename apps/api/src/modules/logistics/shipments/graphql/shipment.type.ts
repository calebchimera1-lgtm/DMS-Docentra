import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class ShipmentWarehouseRef {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;
}

@ObjectType()
export class ShipmentAccountRef {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;
}

@ObjectType()
export class ShipmentVehicleRef {
  @Field(() => ID)
  id!: string;

  @Field()
  registrationNumber!: string;
}

@ObjectType()
export class ShipmentDriverRef {
  @Field(() => ID)
  id!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;
}

@ObjectType()
export class DeliveryEventItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  status!: string;

  @Field({ nullable: true })
  location?: string;

  @Field({ nullable: true })
  note?: string;

  @Field()
  occurredAt!: Date;
}

@ObjectType()
export class ShipmentItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  shipmentNumber!: string;

  @Field()
  status!: string;

  @Field()
  destinationAddress!: string;

  @Field(() => Int)
  itemCount!: number;

  @Field({ nullable: true })
  dispatchedAt?: Date;

  @Field({ nullable: true })
  deliveredAt?: Date;

  @Field({ nullable: true })
  failureReason?: string;

  @Field(() => ShipmentWarehouseRef)
  warehouse!: ShipmentWarehouseRef;

  @Field(() => ShipmentAccountRef, { nullable: true })
  account?: ShipmentAccountRef;

  @Field(() => ShipmentVehicleRef, { nullable: true })
  vehicle?: ShipmentVehicleRef;

  @Field(() => ShipmentDriverRef, { nullable: true })
  driver?: ShipmentDriverRef;

  @Field(() => [DeliveryEventItemType])
  events!: DeliveryEventItemType[];
}
