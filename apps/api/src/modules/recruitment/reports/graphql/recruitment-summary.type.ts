import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class RecruitmentSummaryType {
  @Field(() => Int)
  openPostingCount!: number;

  @Field(() => Int)
  activeApplicationCount!: number;

  @Field(() => Int)
  scheduledInterviewCount!: number;

  @Field(() => Int)
  hiredCount!: number;
}

@ObjectType()
export class ApplicationsByStatusType {
  @Field()
  status!: string;

  @Field(() => Int)
  count!: number;
}
