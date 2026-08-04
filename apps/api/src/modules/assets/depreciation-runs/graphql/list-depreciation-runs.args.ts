import { ArgsType, Field, Int, ObjectType } from "@nestjs/graphql";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { DepreciationRunItemType } from "./depreciation-run.type";

@ArgsType()
export class ListDepreciationRunsArgs {
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
}

@ObjectType()
export class PaginatedDepreciationRuns {
  @Field(() => [DepreciationRunItemType])
  items!: DepreciationRunItemType[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;
}
