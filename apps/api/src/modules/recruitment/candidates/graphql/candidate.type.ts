import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class CandidateItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field()
  email!: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  source?: string;
}
