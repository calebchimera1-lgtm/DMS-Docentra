import { ArgsType, Field, Int, ObjectType } from "@nestjs/graphql";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { UserType } from "./user.type";

@ArgsType()
export class ListUsersArgs {
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
}

@ObjectType()
export class PaginatedUsers {
  @Field(() => [UserType])
  items!: UserType[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;
}
