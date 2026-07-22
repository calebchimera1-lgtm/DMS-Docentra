import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class CrmAccountRef {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;
}

@ObjectType()
export class CrmContactType {
  @Field(() => ID)
  id!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  title?: string;

  @Field(() => CrmAccountRef, { nullable: true })
  account?: CrmAccountRef;
}
