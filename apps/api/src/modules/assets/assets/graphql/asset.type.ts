import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class AssetCategoryRef {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;
}

@ObjectType()
export class AssetItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  assetNumber!: string;

  @Field()
  name!: string;

  @Field()
  purchaseDate!: Date;

  @Field(() => Int)
  purchaseCostCents!: number;

  @Field(() => Int)
  salvageValueCents!: number;

  @Field(() => Int)
  usefulLifeMonths!: number;

  @Field(() => Int)
  accumulatedDepreciationCents!: number;

  @Field()
  currency!: string;

  @Field()
  status!: string;

  @Field(() => AssetCategoryRef)
  category!: AssetCategoryRef;
}
