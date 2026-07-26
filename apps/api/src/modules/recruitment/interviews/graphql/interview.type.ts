import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class InterviewApplicationRef {
  @Field(() => ID)
  id!: string;

  @Field()
  candidateName!: string;

  @Field()
  jobPostingTitle!: string;
}

@ObjectType()
export class InterviewInterviewerRef {
  @Field(() => ID)
  id!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;
}

@ObjectType()
export class InterviewItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  stage!: string;

  @Field()
  scheduledAt!: Date;

  @Field()
  status!: string;

  @Field({ nullable: true })
  feedback?: string;

  @Field(() => Int, { nullable: true })
  rating?: number;

  @Field(() => InterviewApplicationRef)
  application!: InterviewApplicationRef;

  @Field(() => InterviewInterviewerRef, { nullable: true })
  interviewer?: InterviewInterviewerRef;
}
