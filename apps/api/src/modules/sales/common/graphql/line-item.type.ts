import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class LineItemType {
  @Field(() => ID, { nullable: true })
  productId?: string;

  @Field()
  description!: string;

  @Field(() => Int)
  quantity!: number;

  @Field(() => Int)
  unitPriceCents!: number;

  @Field(() => Int)
  totalCents!: number;
}
