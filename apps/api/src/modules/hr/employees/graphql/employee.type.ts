import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { DepartmentRef, EmployeeRef } from "../../common/hr-refs.type";

@ObjectType()
export class EmployeeItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  employeeNumber!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  jobTitle?: string;

  @Field()
  employmentType!: string;

  @Field()
  status!: string;

  @Field()
  hireDate!: Date;

  @Field({ nullable: true })
  terminationDate?: Date;

  @Field(() => Int, { nullable: true })
  salaryCents?: number;

  @Field()
  currency!: string;

  @Field(() => DepartmentRef, { nullable: true })
  department?: DepartmentRef;

  @Field(() => EmployeeRef, { nullable: true })
  manager?: EmployeeRef;
}
