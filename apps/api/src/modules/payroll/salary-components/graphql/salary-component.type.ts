import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class SalaryComponentItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;

  @Field()
  type!: string;

  @Field()
  calculationType!: string;

  @Field(() => Int)
  value!: number;

  @Field()
  isActive!: boolean;
}
