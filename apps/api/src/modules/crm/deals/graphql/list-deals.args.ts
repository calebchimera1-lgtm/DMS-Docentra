import { ArgsType, Field, Int, ObjectType } from "@nestjs/graphql";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { CrmDealStage } from "@omniflow/database";
import { CrmDealType } from "./deal.type";

@ArgsType()
export class ListDealsArgs {
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
  @IsEnum(CrmDealStage)
  stage?: string;
}

@ObjectType()
export class PaginatedCrmDeals {
  @Field(() => [CrmDealType])
  items!: CrmDealType[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;
}
