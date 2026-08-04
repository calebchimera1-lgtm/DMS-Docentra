import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class DepartmentRef {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;
}

@ObjectType()
export class EmployeeRef {
  @Field(() => ID)
  id!: string;

  @Field()
  employeeNumber!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;
}
