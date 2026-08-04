import { ArgsType, Field, Int, ObjectType } from "@nestjs/graphql";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { JournalEntryType } from "./journal-entry.type";

@ArgsType()
export class ListJournalEntriesArgs {
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
export class PaginatedJournalEntries {
  @Field(() => [JournalEntryType])
  items!: JournalEntryType[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;
}
