import { Request } from 'express';
import { prisma } from '../config/prisma';

interface AuditEntry {
  organizationId: string;
  userId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export async function recordAudit(req: Request, entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: entry.organizationId,
      userId: entry.userId ?? null,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: entry.metadata as never,
    },
  });
}
