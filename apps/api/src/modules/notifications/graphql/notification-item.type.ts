import { Field, GraphQLISODateTime, ID, ObjectType } from "@nestjs/graphql";

/**
 * Named NotificationItemType (not NotificationType) to avoid colliding
 * with the Prisma NotificationType enum (INFO/SUCCESS/WARNING/...),
 * which this object's own `type` field holds as a plain string.
 */
@ObjectType()
export class NotificationItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  type!: string;

  @Field()
  title!: string;

  @Field({ nullable: true })
  body?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  readAt?: Date;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}
