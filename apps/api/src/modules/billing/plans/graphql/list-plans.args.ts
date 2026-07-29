import { ArgsType, Field, Int, ObjectType } from "@nestjs/graphql";
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { SubscriptionPlanItemType } from "./plan.type";

@ArgsType()
export class ListPlansArgs {
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
  search?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  billingInterval?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ObjectType()
export class PaginatedSubscriptionPlans {
  @Field(() => [SubscriptionPlanItemType])
  items!: SubscriptionPlanItemType[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;
}
