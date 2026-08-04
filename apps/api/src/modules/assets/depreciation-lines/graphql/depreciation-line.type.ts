import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class DepreciationLineAssetRef {
  @Field(() => ID)
  id!: string;

  @Field()
  assetNumber!: string;

  @Field()
  name!: string;
}

@ObjectType()
export class DepreciationLineRunRef {
  @Field(() => ID)
  id!: string;

  @Field()
  periodDate!: Date;

  @Field()
  status!: string;
}

@ObjectType()
export class DepreciationLineItemType {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  amountCents!: number;

  @Field(() => Int)
  accumulatedAfterCents!: number;

  @Field(() => DepreciationLineAssetRef)
  asset!: DepreciationLineAssetRef;

  @Field(() => DepreciationLineRunRef)
  depreciationRun!: DepreciationLineRunRef;
}
