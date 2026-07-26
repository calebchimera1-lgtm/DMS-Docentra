import { ArgsType, Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import { DepreciationLineItemType } from "./depreciation-line.type";

@ArgsType()
export class ListDepreciationLinesArgs {
  @Field(() => Int, { defaultValue: 1 })
  @IsInt()
  @Min(1)
  page!: number;

  @Field(() => Int, { defaultValue: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize!: number;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  depreciationRunId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  assetId?: string;
}

@ObjectType()
export class PaginatedDepreciationLines {
  @Field(() => [DepreciationLineItemType])
  items!: DepreciationLineItemType[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;
}
