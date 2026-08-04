import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  DomainEvents,
  type InvoicePaidEvent,
  type LeaveRequestReviewedEvent,
  type RoleGrantedEvent,
  type SalesOrderFulfilledEvent,
  type UserCreatedEvent,
} from "../../common/events/domain-events";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "./notifications.service";

/**
 * Cross-module reactions expressed as event listeners rather than direct
 * calls from UsersService — the pattern every future module should follow
 * for "when X happens, notify Y" side effects (e.g. "invoice overdue,
 * notify the assigned accountant").
 */
@Injectable()
export class NotificationTriggersListener {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

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

  @OnEvent(DomainEvents.SALES_ORDER_FULFILLED)
  async onSalesOrderFulfilled(event: SalesOrderFulfilledEvent): Promise<void> {
    if (!event.ownerId) return;
    await this.notifications.create({
      companyId: event.companyId,
      userId: event.ownerId,
      type: "SUCCESS",
      title: "Sales order fulfilled",
      body: `Order ${event.orderNumber} has been fulfilled from stock.`,
    });
  }

  @OnEvent(DomainEvents.INVOICE_PAID)
  async onInvoicePaid(event: InvoicePaidEvent): Promise<void> {
    if (!event.ownerId) return;
    await this.notifications.create({
      companyId: event.companyId,
      userId: event.ownerId,
      type: "SUCCESS",
      title: "Invoice paid",
      body: `Invoice ${event.invoiceNumber} has been marked as paid.`,
    });
  }

  @OnEvent(DomainEvents.LEAVE_REQUEST_REVIEWED)
  async onLeaveRequestReviewed(event: LeaveRequestReviewedEvent): Promise<void> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: event.employeeId },
      select: { userId: true },
    });
    if (!employee?.userId) return;
    const approved = event.status === "APPROVED";
    await this.notifications.create({
      companyId: event.companyId,
      userId: employee.userId,
      type: approved ? "SUCCESS" : "WARNING",
      title: approved ? "Leave request approved" : "Leave request rejected",
      body: approved
        ? "Your leave request has been approved."
        : "Your leave request has been rejected.",
    });
  }
}
