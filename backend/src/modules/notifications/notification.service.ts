import { prisma } from '../../config/prisma';
import { sendEmail } from '../../utils/email';
import { emitToUser } from '../../sockets';

export async function createNotification(
  organizationId: string,
  userId: string,
  type: string,
  title: string,
  message: string,
  data?: Record<string, unknown>,
  options: { email?: boolean } = {},
) {
  const notification = await prisma.notification.create({
    data: { organizationId, userId, type, title, message, data: data as never },
  });

  emitToUser(userId, 'notification:new', notification);

  if (options.email) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await sendEmail(user.email, title, `<p>${message}</p>`);
    }
  }

  return notification;
}

export async function listNotifications(userId: string, filters: { unreadOnly?: boolean; page?: number; pageSize?: number }) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const where = { userId, ...(filters.unreadOnly ? { isRead: false } : {}) };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return { notifications, total, page, pageSize, unreadCount };
}

export async function markAsRead(userId: string, notificationId: string) {
  await prisma.notification.updateMany({ where: { id: notificationId, userId }, data: { isRead: true } });
}

export async function markAllAsRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
}
