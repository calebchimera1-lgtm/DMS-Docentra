import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class JournalLineItemType {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  debitCents!: number;

  @Field(() => Int)
  creditCents!: number;

  @Field({ nullable: true })
  description?: string;

  @Field(() => ID)
  ledgerAccountId!: string;

  @Field()
  ledgerAccountCode!: string;

  @Field()
  ledgerAccountName!: string;
}

@ObjectType()
export class JournalEntryType {
  @Field(() => ID)
  id!: string;

  @Field()
  entryNumber!: string;

  @Field()
  status!: string;

  @Field()
  entryDate!: Date;

  @Field({ nullable: true })
  memo?: string;

  @Field(() => [JournalLineItemType])
  lines!: JournalLineItemType[];
}
