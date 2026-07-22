import { ArgsType, Field, Int, ObjectType } from "@nestjs/graphql";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { CrmLeadStatus } from "@omniflow/database";
import { CrmLeadType } from "./lead.type";

@ArgsType()
export class ListLeadsArgs {
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
  @IsEnum(CrmLeadStatus)
  status?: string;
}

@ObjectType()
export class PaginatedCrmLeads {
  @Field(() => [CrmLeadType])
  items!: CrmLeadType[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;
}
