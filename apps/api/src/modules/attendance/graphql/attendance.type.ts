import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class AttendanceEmployeeRef {
  @Field(() => ID)
  id!: string;

  @Field()
  employeeNumber!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;
}

@ObjectType()
export class AttendanceItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  date!: Date;

  @Field({ nullable: true })
  clockInAt?: Date;

  @Field({ nullable: true })
  clockOutAt?: Date;

  @Field()
  status!: string;

  @Field(() => Int, { nullable: true })
  workedMinutes?: number;

  @Field(() => AttendanceEmployeeRef)
  employee!: AttendanceEmployeeRef;
}
