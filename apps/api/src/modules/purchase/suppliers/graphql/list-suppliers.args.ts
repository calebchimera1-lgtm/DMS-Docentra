import { ArgsType, Field, Int, ObjectType } from "@nestjs/graphql";
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { SupplierItemType } from "./supplier.type";

@ArgsType()
export class ListSuppliersArgs {
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
  @IsBoolean()
  isActive?: boolean;
}

@ObjectType()
export class PaginatedSuppliers {
  @Field(() => [SupplierItemType])
  items!: SupplierItemType[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;
}
