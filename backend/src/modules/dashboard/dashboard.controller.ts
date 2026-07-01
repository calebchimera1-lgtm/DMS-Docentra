import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import * as service from './dashboard.service';

export const getUserDashboard = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.getUserDashboard(req.user!.organizationId, req.user!.sub) });
});

export const getExecutiveDashboard = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.getExecutiveDashboard(req.user!.organizationId) });
});

export const getComplianceReport = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.getComplianceReport(req.user!.organizationId) });
});
