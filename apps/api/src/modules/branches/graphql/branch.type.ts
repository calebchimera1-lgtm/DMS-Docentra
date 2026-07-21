import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class BranchType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;

  @Field()
  isHeadquarters!: boolean;

  @Field()
  status!: string;

  @Field({ nullable: true })
  city?: string;

  @Field({ nullable: true })
  country?: string;
}
