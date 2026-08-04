import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class ProjectsSummaryType {
  @Field(() => Int)
  activeProjectCount!: number;

  @Field(() => Int)
  totalProjectCount!: number;

  @Field(() => Int)
  openTaskCount!: number;

  @Field(() => Int)
  overdueTaskCount!: number;

  @Field(() => Int)
  totalMinutesLogged!: number;
}

@ObjectType()
export class TasksByStatusType {
  @Field()
  status!: string;

  @Field(() => Int)
  count!: number;
}
