import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class CrmAccountType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  industry?: string;

  @Field({ nullable: true })
  website?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field(() => Int, { nullable: true })
  contactCount?: number;

  @Field(() => Int, { nullable: true })
  dealCount?: number;
}
