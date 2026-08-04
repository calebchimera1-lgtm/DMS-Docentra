import { ArgsType, Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import { TimeEntryItemType } from "./time-entry.type";

@ArgsType()
export class ListTimeEntriesArgs {
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
  taskId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  billable?: boolean;
}

@ObjectType()
export class PaginatedTimeEntries {
  @Field(() => [TimeEntryItemType])
  items!: TimeEntryItemType[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;
}
