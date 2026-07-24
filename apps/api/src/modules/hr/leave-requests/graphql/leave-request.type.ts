import { Field, ID, ObjectType } from "@nestjs/graphql";
import { EmployeeRef } from "../../common/hr-refs.type";

@ObjectType()
export class LeaveRequestItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  type!: string;

  @Field()
  startDate!: Date;

  @Field()
  endDate!: Date;

  @Field()
  status!: string;

  @Field({ nullable: true })
  reason?: string;

  @Field({ nullable: true })
  reviewedAt?: Date;

  @Field(() => EmployeeRef)
  employee!: EmployeeRef;

  @Field(() => EmployeeRef, { nullable: true })
  approver?: EmployeeRef;

  @Field()
  createdAt!: Date;
}
