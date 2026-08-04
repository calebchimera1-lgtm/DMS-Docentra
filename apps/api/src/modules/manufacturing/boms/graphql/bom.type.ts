import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class BomProductRef {
  @Field(() => ID)
  id!: string;

  @Field()
  sku!: string;

  @Field()
  name!: string;
}

@ObjectType()
export class BomLineItemType {
  @Field(() => ID)
  id!: string;

  @Field(() => BomProductRef)
  componentProduct!: BomProductRef;

  @Field(() => Int)
  quantity!: number;
}

@ObjectType()
export class BomItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  isActive!: boolean;

  @Field(() => BomProductRef)
  product!: BomProductRef;

  @Field(() => [BomLineItemType])
  lines!: BomLineItemType[];
}
