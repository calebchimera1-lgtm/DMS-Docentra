import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class CrmSummaryType {
  @Field(() => Int)
  accountCount!: number;

  @Field(() => Int)
  contactCount!: number;

  @Field(() => Int)
  openLeadCount!: number;

  @Field(() => Int)
  openDealCount!: number;

  @Field(() => Int)
  openPipelineValueCents!: number;

  @Field(() => Int)
  wonValueCents!: number;
}
