import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../auth/interfaces/jwt-payload.interface";
import { ListNotificationsQueryDto } from "./dto/list-notifications-query.dto";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@ApiBearerAuth()
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's notifications" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListNotificationsQueryDto) {
    return this.notificationsService.list(user.id, query);
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Unread notification count for the current user" })
  async unreadCount(@CurrentUser() user: RequestUser) {
    return { count: await this.notificationsService.unreadCount(user.id) };
  }

  @Post(":id/read")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Mark one notification as read" })
  async markRead(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.notificationsService.markRead(user.id, id);
  }

  @Post("read-all")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Mark every notification as read" })
  async markAllRead(@CurrentUser() user: RequestUser): Promise<void> {
    await this.notificationsService.markAllRead(user.id);
  }
}
