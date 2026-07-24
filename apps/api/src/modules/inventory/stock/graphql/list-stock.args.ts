import { ArgsType, Field, Int, ObjectType } from "@nestjs/graphql";
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { StockItemType } from "./stock-item.type";

@ArgsType()
export class ListStockArgs {
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
  @IsUUID()
  warehouseId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  lowStock?: boolean;
}

@ObjectType()
export class PaginatedStockItems {
  @Field(() => [StockItemType])
  items!: StockItemType[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;
}
