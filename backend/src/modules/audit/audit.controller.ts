import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import * as service from './audit.service';

function parseFilters(req: Request): service.AuditFilters {
  const { userId, action, resourceType, dateFrom, dateTo, page, pageSize } = req.query;
  return {
    userId: userId as string,
    action: action as string,
    resourceType: resourceType as string,
    dateFrom: dateFrom as string,
    dateTo: dateTo as string,
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined,
  };
}

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.listAuditLogs(req.user!.organizationId, parseFilters(req)) });
});

export const exportAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const csv = await service.exportAuditLogsCsv(req.user!.organizationId, parseFilters(req));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
  res.send(csv);
});
