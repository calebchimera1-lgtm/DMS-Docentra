import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { recordAudit } from '../../utils/audit';
import * as service from './folder.service';

export const listFolders = asyncHandler(async (req: Request, res: Response) => {
  const parentId = req.query.parentId as string | undefined;
  const data = await service.listFolders(req.user!.organizationId, parentId === 'root' ? null : parentId);
  res.json({ success: true, data });
});

export const getBreadcrumb = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getFolderBreadcrumb(req.user!.organizationId, req.params.folderId);
  res.json({ success: true, data });
});

export const createFolder = asyncHandler(async (req: Request, res: Response) => {
  const folder = await service.createFolder(req.user!.organizationId, req.user!.sub, req.body);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'folder.create', resourceType: 'folder', resourceId: folder.id });
  res.status(201).json({ success: true, data: folder });
});

export const renameFolder = asyncHandler(async (req: Request, res: Response) => {
  const folder = await service.renameFolder(req.user!.organizationId, req.params.folderId, req.body.name);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'folder.rename', resourceType: 'folder', resourceId: folder.id });
  res.json({ success: true, data: folder });
});

export const moveFolder = asyncHandler(async (req: Request, res: Response) => {
  const folder = await service.moveFolder(req.user!.organizationId, req.params.folderId, req.body.parentId ?? null);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'folder.move', resourceType: 'folder', resourceId: folder.id });
  res.json({ success: true, data: folder });
});

export const deleteFolder = asyncHandler(async (req: Request, res: Response) => {
  await service.deleteFolder(req.user!.organizationId, req.params.folderId);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'folder.delete', resourceType: 'folder', resourceId: req.params.folderId });
  res.json({ success: true });
});

export const archiveFolder = asyncHandler(async (req: Request, res: Response) => {
  const folder = await service.archiveFolder(req.user!.organizationId, req.params.folderId, req.body.isArchive);
  res.json({ success: true, data: folder });
});
