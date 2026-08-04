import { Args, ID, Int, Mutation, Query, Resolver } from "@nestjs/graphql";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../auth/interfaces/jwt-payload.interface";
import { NotificationItemType } from "./graphql/notification-item.type";
import { NotificationsService } from "./notifications.service";

@Resolver(() => NotificationItemType)
export class NotificationsResolver {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Query(() => [NotificationItemType], { name: "notifications" })
  async notifications(
    @CurrentUser() user: RequestUser,
    @Args("unreadOnly", { type: () => Boolean, nullable: true }) unreadOnly?: boolean,
  ) {
    const result = await this.notificationsService.list(user.id, { unreadOnly });
    return result.items;
  }

  @Query(() => Int, { name: "unreadNotificationCount" })
  unreadCount(@CurrentUser() user: RequestUser) {
    return this.notificationsService.unreadCount(user.id);
  }

  @Mutation(() => Boolean, { name: "markNotificationRead" })
  async markRead(@CurrentUser() user: RequestUser, @Args("id", { type: () => ID }) id: string): Promise<boolean> {
    await this.notificationsService.markRead(user.id, id);
    return true;
  }
}
