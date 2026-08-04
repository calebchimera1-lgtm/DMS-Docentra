import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class AccountingSummaryType {
  @Field(() => Int)
  ledgerAccountCount!: number;

  @Field(() => Int)
  draftEntryCount!: number;

  @Field(() => Int)
  totalAssetsCents!: number;

  @Field(() => Int)
  totalLiabilitiesCents!: number;

  @Field(() => Int)
  totalEquityCents!: number;

  @Field(() => Int)
  totalRevenueCents!: number;

  @Field(() => Int)
  totalExpensesCents!: number;

  @Field(() => Int)
  netIncomeCents!: number;
}
