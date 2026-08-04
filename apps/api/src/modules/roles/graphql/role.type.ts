import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class PermissionRef {
  @Field(() => ID)
  id!: string;

  @Field()
  key!: string;

  @Field()
  module!: string;

  @Field()
  action!: string;
}

@ObjectType()
export class RoleType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  isSystem!: boolean;

  @Field(() => [PermissionRef])
  permissions!: PermissionRef[];
}
