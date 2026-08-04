import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class CrmLeadType {
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
  companyName?: string;

  @Field({ nullable: true })
  source?: string;

  @Field()
  status!: string;
}
