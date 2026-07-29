import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class SubscriptionPlanItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  code!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Int)
  priceCents!: number;

  @Field()
  currency!: string;

  @Field()
  billingInterval!: string;

  @Field(() => Int)
  trialDays!: number;

  @Field()
  isActive!: boolean;

  @Field(() => Int)
  subscriptionCount!: number;
}
