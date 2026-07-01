import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { recordAudit } from '../../utils/audit';
import * as service from './org.service';

export const getMyOrganization = asyncHandler(async (req: Request, res: Response) => {
  const org = await service.getOrganization(req.user!.organizationId);
  res.json({ success: true, data: org });
});

export const updateMyOrganization = asyncHandler(async (req: Request, res: Response) => {
  const org = await service.updateOrganization(req.user!.organizationId, req.body);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'org.settings.update' });
  res.json({ success: true, data: org });
});

export const listBranches = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.listBranches(req.user!.organizationId) });
});
export const createBranch = asyncHandler(async (req: Request, res: Response) => {
  const branch = await service.createBranch(req.user!.organizationId, req.body);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'branch.create', resourceType: 'branch', resourceId: branch.id });
  res.status(201).json({ success: true, data: branch });
});
export const updateBranch = asyncHandler(async (req: Request, res: Response) => {
  const branch = await service.updateBranch(req.user!.organizationId, req.params.branchId, req.body);
  res.json({ success: true, data: branch });
});
export const deleteBranch = asyncHandler(async (req: Request, res: Response) => {
  await service.deleteBranch(req.user!.organizationId, req.params.branchId);
  res.json({ success: true });
});

export const listDepartments = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.listDepartments(req.user!.organizationId) });
});
export const createDepartment = asyncHandler(async (req: Request, res: Response) => {
  const dept = await service.createDepartment(req.user!.organizationId, req.body);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'department.create', resourceType: 'department', resourceId: dept.id });
  res.status(201).json({ success: true, data: dept });
});
export const updateDepartment = asyncHandler(async (req: Request, res: Response) => {
  const dept = await service.updateDepartment(req.user!.organizationId, req.params.departmentId, req.body);
  res.json({ success: true, data: dept });
});
export const deleteDepartment = asyncHandler(async (req: Request, res: Response) => {
  await service.deleteDepartment(req.user!.organizationId, req.params.departmentId);
  res.json({ success: true });
});

export const listRoles = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.listRoles(req.user!.organizationId) });
});
export const createRole = asyncHandler(async (req: Request, res: Response) => {
  const role = await service.createRole(req.user!.organizationId, req.body);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'role.create', resourceType: 'role', resourceId: role.id });
  res.status(201).json({ success: true, data: role });
});
export const updateRolePermissions = asyncHandler(async (req: Request, res: Response) => {
  const role = await service.updateRolePermissions(req.user!.organizationId, req.params.roleId, req.body.permissionKeys);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'role.permissions.update', resourceType: 'role', resourceId: role.id });
  res.json({ success: true, data: role });
});
export const deleteRole = asyncHandler(async (req: Request, res: Response) => {
  await service.deleteRole(req.user!.organizationId, req.params.roleId);
  res.json({ success: true });
});

export const listPermissions = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await service.listAllPermissions() });
});
