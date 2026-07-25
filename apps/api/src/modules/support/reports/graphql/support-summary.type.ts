import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class SupportSummaryType {
  @Field(() => Int)
  openTicketCount!: number;

  @Field(() => Int)
  unassignedTicketCount!: number;

  @Field(() => Int)
  overdueTicketCount!: number;

  @Field(() => Int)
  totalTicketCount!: number;
}

@ObjectType()
export class TicketsByStatusType {
  @Field()
  status!: string;

  @Field(() => Int)
  count!: number;
}
