import { Module } from "@nestjs/common";
import { NotificationTriggersListener } from "./notification-triggers.listener";
import { NotificationsController } from "./notifications.controller";
import { NotificationsResolver } from "./notifications.resolver";
import { NotificationsService } from "./notifications.service";

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationTriggersListener, NotificationsResolver],
  exports: [NotificationsService],
})
export class NotificationsModule {}
