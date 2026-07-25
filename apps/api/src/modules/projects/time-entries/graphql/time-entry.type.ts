import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { ProjectUserRef } from "../../common/project-refs.type";

@ObjectType()
export class TimeEntryTaskRef {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;
}

@ObjectType()
export class TimeEntryItemType {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  minutes!: number;

  @Field()
  entryDate!: Date;

  @Field({ nullable: true })
  note?: string;

  @Field()
  billable!: boolean;

  @Field(() => TimeEntryTaskRef)
  task!: TimeEntryTaskRef;

  @Field(() => ProjectUserRef)
  user!: ProjectUserRef;
}
