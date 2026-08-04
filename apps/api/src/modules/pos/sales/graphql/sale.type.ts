import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class PosSaleSessionRef {
  @Field(() => ID)
  id!: string;

  @Field()
  sessionNumber!: string;
}

@ObjectType()
export class PosSaleAccountRef {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;
}

@ObjectType()
export class PosSaleItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  saleNumber!: string;

  @Field(() => Int)
  totalCents!: number;

  @Field()
  currency!: string;

  @Field()
  paymentMethod!: string;

  @Field()
  status!: string;

  @Field(() => PosSaleSessionRef)
  session!: PosSaleSessionRef;

  @Field(() => PosSaleAccountRef, { nullable: true })
  account?: PosSaleAccountRef;
}
