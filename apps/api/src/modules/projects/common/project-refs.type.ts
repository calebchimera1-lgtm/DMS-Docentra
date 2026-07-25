import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class ProjectRef {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;
}

@ObjectType()
export class ProjectUserRef {
  @Field(() => ID)
  id!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;
}
