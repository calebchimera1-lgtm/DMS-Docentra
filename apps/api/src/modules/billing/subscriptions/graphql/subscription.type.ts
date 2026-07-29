import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class SubscriptionAccountRef {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;
}

@ObjectType()
export class SubscriptionPlanRef {
  @Field(() => ID)
  id!: string;

  @Field()
  code!: string;

  @Field()
  name!: string;

  @Field(() => Int)
  priceCents!: number;

  @Field()
  billingInterval!: string;
}

@ObjectType()
export class SubscriptionInvoiceItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  periodStart!: Date;

  @Field()
  periodEnd!: Date;

  @Field(() => Int)
  amountCents!: number;

  @Field()
  invoiceNumber!: string;

  @Field()
  invoiceStatus!: string;
}

@ObjectType()
export class SubscriptionItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  status!: string;

  @Field(() => Int)
  quantity!: number;

  @Field()
  startDate!: Date;

  @Field()
  currentPeriodStart!: Date;

  @Field()
  currentPeriodEnd!: Date;

  @Field({ nullable: true })
  trialEndsAt?: Date;

  @Field(() => SubscriptionAccountRef)
  account!: SubscriptionAccountRef;

  @Field(() => SubscriptionPlanRef)
  plan!: SubscriptionPlanRef;

  @Field(() => [SubscriptionInvoiceItemType])
  invoices!: SubscriptionInvoiceItemType[];
}
