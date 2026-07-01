import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { recordAudit } from '../../utils/audit';
import * as service from './user.service';

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { departmentId, branchId, search, page, pageSize } = req.query;
  const result = await service.listUsers(req.user!.organizationId, {
    departmentId: departmentId as string,
    branchId: branchId as string,
    search: search as string,
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined,
  });
  res.json({ success: true, data: result });
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.getUser(req.user!.organizationId, req.params.userId) });
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await service.createUser(req.user!.organizationId, req.body);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'user.create', resourceType: 'user', resourceId: user.id });
  res.status(201).json({ success: true, data: user });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await service.updateUser(req.user!.organizationId, req.params.userId, req.body);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'user.update', resourceType: 'user', resourceId: user.id });
  res.json({ success: true, data: user });
});

export const deactivateUser = asyncHandler(async (req: Request, res: Response) => {
  await service.deactivateUser(req.user!.organizationId, req.params.userId);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'user.deactivate', resourceType: 'user', resourceId: req.params.userId });
  res.json({ success: true });
});

export const assignRoles = asyncHandler(async (req: Request, res: Response) => {
  const user = await service.assignRoles(req.user!.organizationId, req.params.userId, req.body.roleIds);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'user.roles.update', resourceType: 'user', resourceId: user.id });
  res.json({ success: true, data: user });
});

export const getUserActivity = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.getUserActivity(req.user!.organizationId, req.params.userId) });
});

export const grantTemporaryAccess = asyncHandler(async (req: Request, res: Response) => {
  const access = await service.grantTemporaryAccess(req.params.userId, req.body);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'user.temp_access.grant', resourceType: 'user', resourceId: req.params.userId });
  res.status(201).json({ success: true, data: access });
});
