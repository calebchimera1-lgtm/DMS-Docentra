import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { ProjectUserRef } from "../../common/project-refs.type";

@ObjectType()
export class ProjectAccountRef {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;
}

@ObjectType()
export class ProjectItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  status!: string;

  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  endDate?: Date;

  @Field(() => Int, { nullable: true })
  budgetCents?: number;

  @Field()
  currency!: string;

  @Field(() => ProjectAccountRef, { nullable: true })
  account?: ProjectAccountRef;

  @Field(() => ProjectUserRef, { nullable: true })
  owner?: ProjectUserRef;
}
