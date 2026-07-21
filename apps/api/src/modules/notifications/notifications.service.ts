import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { NotificationType, Prisma } from "@omniflow/database";
import { PrismaService } from "../../prisma/prisma.service";
import { DomainEvents } from "../../common/events/domain-events";

export interface CreateNotificationInput {
  companyId: string;
  userId: string;
  type?: NotificationType;
  title: string;
  body?: string;
  data?: Prisma.InputJsonValue;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        type: input.type ?? "INFO",
        title: input.title,
        body: input.body,
        data: input.data,
      },
    });

    this.events.emit(DomainEvents.NOTIFICATION_CREATED, { notification });
    return notification;
  }

  async list(userId: string, options: { unreadOnly?: boolean; page?: number; pageSize?: number } = {}) {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;
    const where = { userId, ...(options.unreadOnly ? { readAt: null } : {}) };

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
