import { ArgsType, Field, Int, ObjectType } from "@nestjs/graphql";
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { StockMovementItemType } from "./movement.type";

@ArgsType()
export class ListMovementsArgs {
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
  @IsUUID()
  productId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  type?: string;
}

@ObjectType()
export class PaginatedStockMovements {
  @Field(() => [StockMovementItemType])
  items!: StockMovementItemType[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;
}
