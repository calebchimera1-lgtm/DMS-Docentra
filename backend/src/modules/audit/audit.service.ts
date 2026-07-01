import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

export interface AuditFilters {
  userId?: string;
  action?: string;
  resourceType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export async function listAuditLogs(organizationId: string, filters: AuditFilters) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;

  const where: Prisma.AuditLogWhereInput = {
    organizationId,
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.action ? { action: { contains: filters.action } } : {}),
    ...(filters.resourceType ? { resourceType: filters.resourceType } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          createdAt: {
            ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
            ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
          },
        }
      : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total, page, pageSize };
}

export async function exportAuditLogsCsv(organizationId: string, filters: AuditFilters): Promise<string> {
  const { logs } = await listAuditLogs(organizationId, { ...filters, page: 1, pageSize: 10000 });
  const header = 'timestamp,user,action,resourceType,resourceId,ipAddress\n';
  const rows = logs
    .map((l) =>
      [
        l.createdAt.toISOString(),
        l.user ? `${l.user.firstName} ${l.user.lastName} <${l.user.email}>` : 'system',
        l.action,
        l.resourceType ?? '',
        l.resourceId ?? '',
        l.ipAddress ?? '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n');
  return header + rows;
}
