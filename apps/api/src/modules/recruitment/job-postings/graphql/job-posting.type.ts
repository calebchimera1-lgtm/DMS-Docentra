import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class JobPostingDepartmentRef {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;
}

@ObjectType()
export class JobPostingItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field()
  employmentType!: string;

  @Field(() => Int)
  openings!: number;

  @Field(() => Int)
  applicationCount!: number;

  @Field()
  status!: string;

  @Field(() => JobPostingDepartmentRef, { nullable: true })
  department?: JobPostingDepartmentRef;
}
