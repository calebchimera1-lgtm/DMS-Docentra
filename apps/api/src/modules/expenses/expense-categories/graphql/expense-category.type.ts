import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class ExpenseCategoryItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;

  @Field(() => ID, { nullable: true })
  ledgerAccountId?: string;

  @Field()
  isActive!: boolean;
}
