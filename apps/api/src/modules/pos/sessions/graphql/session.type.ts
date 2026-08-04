import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class PosSessionWarehouseRef {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;
}

@ObjectType()
export class PosSessionItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  sessionNumber!: string;

  @Field()
  status!: string;

  @Field(() => Int)
  openingFloatCents!: number;

  @Field(() => Int, { nullable: true })
  expectedCashCents?: number;

  @Field(() => Int, { nullable: true })
  countedCashCents?: number;

  @Field(() => Int, { nullable: true })
  cashDifferenceCents?: number;

  @Field(() => PosSessionWarehouseRef)
  warehouse!: PosSessionWarehouseRef;
}
