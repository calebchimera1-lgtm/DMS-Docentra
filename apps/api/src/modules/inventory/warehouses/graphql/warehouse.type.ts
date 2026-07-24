import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class WarehouseType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;

  @Field({ nullable: true })
  address?: string;

  @Field()
  isActive!: boolean;

  @Field(() => Int, { nullable: true })
  stockItemCount?: number;
}
