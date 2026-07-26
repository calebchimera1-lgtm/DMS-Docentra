import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class AttendanceSummaryType {
  @Field(() => Int)
  presentCount!: number;

  @Field(() => Int)
  lateCount!: number;

  @Field(() => Int)
  absentCount!: number;

  @Field(() => Int)
  onLeaveCount!: number;

  @Field(() => Int)
  activeEmployeeCount!: number;
}

@ObjectType()
export class AttendanceByStatusType {
  @Field()
  status!: string;

  @Field(() => Int)
  count!: number;
}
