import { Field, ID, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class TicketAccountRef {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;
}

@ObjectType()
export class TicketContactRef {
  @Field(() => ID)
  id!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;
}

@ObjectType()
export class TicketUserRef {
  @Field(() => ID)
  id!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;
}

@ObjectType()
export class TicketItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  ticketNumber!: string;

  @Field()
  subject!: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  status!: string;

  @Field()
  priority!: string;

  @Field({ nullable: true })
  requesterEmail?: string;

  @Field({ nullable: true })
  dueDate?: Date;

  @Field({ nullable: true })
  resolvedAt?: Date;

  @Field({ nullable: true })
  closedAt?: Date;

  @Field(() => TicketAccountRef, { nullable: true })
  account?: TicketAccountRef;

  @Field(() => TicketContactRef, { nullable: true })
  contact?: TicketContactRef;

  @Field(() => TicketUserRef, { nullable: true })
  assignee?: TicketUserRef;

  @Field()
  createdAt!: Date;
}
