import type { Notification } from "@omniflow/database";

/**
 * The application's internal event bus (NestJS EventEmitter2, in-process
 * pub/sub) — the decoupling point between modules, and the extension
 * point the plugin system hooks into (see modules/plugins). A module
 * emits a fact about what happened; listeners (realtime push, plugin
 * webhooks, cross-module side effects like a welcome notification) react
 * without the emitter knowing or caring who's listening.
 */
export const DomainEvents = {
  NOTIFICATION_CREATED: "notification.created",
  USER_CREATED: "user.created",
  ROLE_GRANTED: "role.granted",
  AUDIT_LOGGED: "audit.logged",
  SALES_ORDER_FULFILLED: "sales_order.fulfilled",
  INVOICE_PAID: "invoice.paid",
  LEAVE_REQUEST_REVIEWED: "leave_request.reviewed",
} as const;

export interface NotificationCreatedEvent {
  notification: Notification;
}

export interface UserCreatedEvent {
  userId: string;
  companyId: string;
  email: string;
}

export interface RoleGrantedEvent {
  userId: string;
  companyId: string;
  roleName: string;
}

export interface AuditLoggedEvent {
  companyId: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
}

export interface SalesOrderFulfilledEvent {
  companyId: string;
  orderId: string;
  orderNumber: string;
  ownerId: string | null;
}

export interface InvoicePaidEvent {
  companyId: string;
  invoiceId: string;
  invoiceNumber: string;
  ownerId: string | null;
}

export interface LeaveRequestReviewedEvent {
  companyId: string;
  leaveRequestId: string;
  employeeId: string;
  status: "APPROVED" | "REJECTED";
}
