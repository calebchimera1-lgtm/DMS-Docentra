import { Field, ID, ObjectType } from "@nestjs/graphql";
import { EmployeeRef } from "../../common/hr-refs.type";

@ObjectType()
export class DepartmentItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;

  @Field()
  isActive!: boolean;

  @Field(() => EmployeeRef, { nullable: true })
  manager?: EmployeeRef;
}
