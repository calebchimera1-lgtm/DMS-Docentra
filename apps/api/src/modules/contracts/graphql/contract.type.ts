import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class ContractAccountRef {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;
}

@ObjectType()
export class ContractOwnerRef {
  @Field(() => ID)
  id!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;
}

@ObjectType()
export class ContractItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  contractNumber!: string;

  @Field()
  title!: string;

  @Field()
  type!: string;

  @Field(() => Int)
  valueCents!: number;

  @Field()
  currency!: string;

  @Field()
  startDate!: Date;

  @Field()
  endDate!: Date;

  @Field()
  status!: string;

  @Field(() => ContractAccountRef, { nullable: true })
  account?: ContractAccountRef;

  @Field(() => ContractOwnerRef, { nullable: true })
  owner?: ContractOwnerRef;
}
