import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { CrmAccountRef } from "../../../crm/contacts/graphql/contact.type";
import { LineItemType } from "../../common/graphql/line-item.type";

@ObjectType()
export class InvoiceType {
  @Field(() => ID)
  id!: string;

  @Field()
  invoiceNumber!: string;

  @Field()
  status!: string;

  @Field(() => [LineItemType])
  items!: LineItemType[];

  @Field(() => Int)
  totalCents!: number;

  @Field()
  currency!: string;

  @Field({ nullable: true })
  dueDate?: Date;

  @Field({ nullable: true })
  paidAt?: Date;

  @Field(() => CrmAccountRef, { nullable: true })
  account?: CrmAccountRef;
}
