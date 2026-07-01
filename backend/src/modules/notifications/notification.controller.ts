import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import * as service from './notification.service';

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const { unreadOnly, page, pageSize } = req.query;
  const result = await service.listNotifications(req.user!.sub, {
    unreadOnly: unreadOnly === 'true',
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined,
  });
  res.json({ success: true, data: result });
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  await service.markAsRead(req.user!.sub, req.params.notificationId);
  res.json({ success: true });
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  await service.markAllAsRead(req.user!.sub);
  res.json({ success: true });
});
