import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class FolderParentRef {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;
}

@ObjectType()
export class DocumentFolderItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => FolderParentRef, { nullable: true })
  parent?: FolderParentRef;

  @Field(() => Int)
  subfolderCount!: number;

  @Field(() => Int)
  documentCount!: number;
}
