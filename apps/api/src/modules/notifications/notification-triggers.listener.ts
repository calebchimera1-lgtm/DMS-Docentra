import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  DomainEvents,
  type RoleGrantedEvent,
  type UserCreatedEvent,
} from "../../common/events/domain-events";
import { NotificationsService } from "./notifications.service";

/**
 * Cross-module reactions expressed as event listeners rather than direct
 * calls from UsersService — the pattern every future module should follow
 * for "when X happens, notify Y" side effects (e.g. "invoice overdue,
 * notify the assigned accountant").
 */
@Injectable()
export class NotificationTriggersListener {
  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(DomainEvents.USER_CREATED)
  async onUserCreated(event: UserCreatedEvent): Promise<void> {
    await this.notifications.create({
      companyId: event.companyId,
      userId: event.userId,
      type: "SUCCESS",
      title: "Welcome to Omniflow",
      body: "Your account is ready. Take a look around the dashboard to get started.",
    });
  }

  @OnEvent(DomainEvents.ROLE_GRANTED)
  async onRoleGranted(event: RoleGrantedEvent): Promise<void> {
    await this.notifications.create({
      companyId: event.companyId,
      userId: event.userId,
      type: "INFO",
      title: "New role granted",
      body: `You've been granted the "${event.roleName}" role.`,
    });
  }
}
