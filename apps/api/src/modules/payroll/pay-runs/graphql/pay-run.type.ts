import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class PayRunItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  periodStart!: Date;

  @Field()
  periodEnd!: Date;

  @Field({ nullable: true })
  paymentDate?: Date;

  @Field()
  status!: string;

  @Field(() => Int)
  payslipCount!: number;

  @Field()
  createdAt!: Date;
}
