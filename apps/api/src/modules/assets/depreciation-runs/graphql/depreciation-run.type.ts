import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class DepreciationRunItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  periodDate!: Date;

  @Field()
  status!: string;

  @Field(() => Int)
  lineCount!: number;
}
