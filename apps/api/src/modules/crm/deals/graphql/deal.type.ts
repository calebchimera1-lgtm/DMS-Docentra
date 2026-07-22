import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { CrmAccountRef } from "../../contacts/graphql/contact.type";

@ObjectType()
export class CrmDealType {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field(() => Int)
  valueCents!: number;

  @Field()
  currency!: string;

  @Field()
  stage!: string;

  @Field({ nullable: true })
  expectedCloseDate?: Date;

  @Field(() => CrmAccountRef, { nullable: true })
  account?: CrmAccountRef;
}
