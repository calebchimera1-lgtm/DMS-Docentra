import { ArgsType, Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { DocumentItemType } from "./document.type";

@ArgsType()
export class ListDocumentsArgs {
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

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  folderId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  checkedOutOnly?: boolean;
}

@ObjectType()
export class PaginatedDocuments {
  @Field(() => [DocumentItemType])
  items!: DocumentItemType[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;
}
