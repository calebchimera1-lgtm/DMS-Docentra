import { ArgsType, Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { SubscriptionItemType } from "./subscription.type";

@ArgsType()
export class ListSubscriptionsArgs {
  @Field(() => Int, { defaultValue: 1 })
  @IsInt()
  @Min(1)
  page!: number;

  @Field(() => Int, { defaultValue: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  planId?: string;
}

@ObjectType()
export class PaginatedSubscriptions {
  @Field(() => [SubscriptionItemType])
  items!: SubscriptionItemType[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;
}
