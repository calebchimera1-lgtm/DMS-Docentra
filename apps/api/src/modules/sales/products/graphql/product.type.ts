import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class ProductType {
  @Field(() => ID)
  id!: string;

  @Field()
  sku!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Int)
  unitPriceCents!: number;

  @Field()
  currency!: string;

  @Field()
  isActive!: boolean;
}
