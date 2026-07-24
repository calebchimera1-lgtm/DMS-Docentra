import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class PaymentType {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  amountCents!: number;

  @Field()
  currency!: string;

  @Field()
  method!: string;

  @Field()
  paymentDate!: Date;

  @Field({ nullable: true })
  reference?: string;

  @Field({ nullable: true })
  invoiceNumber?: string;
}
