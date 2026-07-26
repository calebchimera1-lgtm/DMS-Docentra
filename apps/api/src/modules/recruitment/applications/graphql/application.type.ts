import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class ApplicationJobPostingRef {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field()
  status!: string;
}

@ObjectType()
export class ApplicationCandidateRef {
  @Field(() => ID)
  id!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field()
  email!: string;
}

@ObjectType()
export class ApplicationItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  status!: string;

  @Field()
  appliedAt!: Date;

  @Field({ nullable: true })
  notes?: string;

  @Field({ nullable: true })
  rejectionReason?: string;

  @Field(() => ApplicationJobPostingRef)
  jobPosting!: ApplicationJobPostingRef;

  @Field(() => ApplicationCandidateRef)
  candidate!: ApplicationCandidateRef;
}
