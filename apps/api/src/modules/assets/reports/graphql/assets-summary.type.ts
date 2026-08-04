import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class AssetsSummaryType {
  @Field(() => Int)
  activeAssetCount!: number;

  @Field(() => Int)
  disposedAssetCount!: number;

  @Field(() => Int)
  totalPurchaseCostCents!: number;

  @Field(() => Int)
  totalAccumulatedDepreciationCents!: number;

  @Field(() => Int)
  totalNetBookValueCents!: number;
}

@ObjectType()
export class AssetsByCategoryType {
  @Field()
  categoryName!: string;

  @Field(() => Int)
  assetCount!: number;

  @Field(() => Int)
  netBookValueCents!: number;
}
