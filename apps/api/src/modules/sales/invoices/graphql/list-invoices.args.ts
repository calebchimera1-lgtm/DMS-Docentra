import { ArgsType, Field, Int, ObjectType } from "@nestjs/graphql";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { InvoiceType } from "./invoice.type";

@ArgsType()
export class ListInvoicesArgs {
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
  status?: string;
}

@ObjectType()
export class PaginatedInvoices {
  @Field(() => [InvoiceType])
  items!: InvoiceType[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;
}
