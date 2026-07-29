import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class DocumentsSummaryType {
  @Field(() => Int)
  draftCount!: number;

  @Field(() => Int)
  publishedCount!: number;

  @Field(() => Int)
  archivedCount!: number;

  @Field(() => Int)
  checkedOutCount!: number;

  @Field(() => Int)
  folderCount!: number;

  @Field(() => Int)
  versionCount!: number;
}

@ObjectType()
export class DocumentsByStatusType {
  @Field()
  status!: string;

  @Field(() => Int)
  count!: number;
}
