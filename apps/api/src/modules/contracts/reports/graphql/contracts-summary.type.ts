import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class ContractsSummaryType {
  @Field(() => Int)
  draftCount!: number;

  @Field(() => Int)
  activeCount!: number;

  @Field(() => Int)
  expiringSoonCount!: number;

  @Field(() => Int)
  totalActiveValueCents!: number;
}

@ObjectType()
export class ContractsByStatusType {
  @Field()
  status!: string;

  @Field(() => Int)
  count!: number;
}
