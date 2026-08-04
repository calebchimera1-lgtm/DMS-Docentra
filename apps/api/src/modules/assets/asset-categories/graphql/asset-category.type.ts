import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class AssetCategoryItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;

  @Field(() => Int)
  defaultUsefulLifeMonths!: number;

  @Field(() => ID, { nullable: true })
  assetAccountId?: string;

  @Field(() => ID, { nullable: true })
  depreciationExpenseAccountId?: string;

  @Field(() => ID, { nullable: true })
  accumulatedDepreciationAccountId?: string;

  @Field()
  isActive!: boolean;
}
