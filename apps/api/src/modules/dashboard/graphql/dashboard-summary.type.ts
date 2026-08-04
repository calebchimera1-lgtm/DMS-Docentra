import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class DashboardSummaryType {
  @Field(() => Int)
  branchCount!: number;

  @Field(() => Int)
  activeUserCount!: number;

  @Field(() => Int)
  totalUserCount!: number;

  @Field(() => Int)
  unreadNotificationCount!: number;
}
