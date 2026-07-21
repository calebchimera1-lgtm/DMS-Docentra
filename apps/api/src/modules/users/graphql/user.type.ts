import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class BranchRef {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;
}

@ObjectType()
export class RoleRef {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;
}

@ObjectType()
export class UserType {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field()
  status!: string;

  @Field(() => [BranchRef])
  branches!: BranchRef[];

  @Field(() => [RoleRef])
  roles!: RoleRef[];
}
