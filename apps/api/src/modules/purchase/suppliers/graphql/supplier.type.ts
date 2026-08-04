import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class SupplierItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field()
  isActive!: boolean;
}
