import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { ProjectRef, ProjectUserRef } from "../../common/project-refs.type";

@ObjectType()
export class ProjectTaskItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  status!: string;

  @Field()
  priority!: string;

  @Field({ nullable: true })
  dueDate?: Date;

  @Field(() => Int, { nullable: true })
  estimatedMinutes?: number;

  @Field(() => ProjectRef)
  project!: ProjectRef;

  @Field(() => ProjectUserRef, { nullable: true })
  assignee?: ProjectUserRef;
}
