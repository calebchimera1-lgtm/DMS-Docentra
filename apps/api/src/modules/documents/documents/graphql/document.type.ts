import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class DocumentFolderRef {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;
}

@ObjectType()
export class DocumentUserRef {
  @Field(() => ID)
  id!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;
}

@ObjectType()
export class DocumentVersionItemType {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  versionNumber!: number;

  @Field()
  fileName!: string;

  @Field({ nullable: true })
  mimeType?: string;

  @Field(() => Int, { nullable: true })
  sizeBytes?: number;

  @Field({ nullable: true })
  note?: string;

  @Field()
  createdAt!: Date;

  @Field(() => DocumentUserRef, { nullable: true })
  createdBy?: DocumentUserRef;
}

@ObjectType()
export class DocumentItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field()
  status!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Int)
  currentVersionNumber!: number;

  @Field(() => DocumentFolderRef, { nullable: true })
  folder?: DocumentFolderRef;

  @Field(() => DocumentUserRef, { nullable: true })
  checkedOutBy?: DocumentUserRef;

  @Field(() => DocumentUserRef, { nullable: true })
  owner?: DocumentUserRef;

  @Field(() => [DocumentVersionItemType])
  versions!: DocumentVersionItemType[];
}
