import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class HrSummaryType {
  @Field(() => Int)
  activeEmployeeCount!: number;

  @Field(() => Int)
  totalEmployeeCount!: number;

  @Field(() => Int)
  onLeaveCount!: number;

  @Field(() => Int)
  departmentCount!: number;

  @Field(() => Int)
  pendingLeaveRequestCount!: number;
}

@ObjectType()
export class DepartmentHeadcountType {
  @Field(() => ID, { nullable: true })
  departmentId?: string;

  @Field()
  departmentName!: string;

  @Field(() => Int)
  employeeCount!: number;
}
