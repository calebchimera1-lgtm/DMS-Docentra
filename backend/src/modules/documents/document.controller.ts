import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { asyncHandler } from '../../utils/asyncHandler';
import { recordAudit } from '../../utils/audit';
import { ApiError } from '../../utils/ApiError';
import { prisma } from '../../config/prisma';
import { createNotification } from '../notifications/notification.service';
import * as service from './document.service';

export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded');
  const tags = req.body.tags ? String(req.body.tags).split(',').map((t) => t.trim()).filter(Boolean) : undefined;
  const document = await service.uploadDocument(req.user!.organizationId, req.user!.sub, req.file, {
    folderId: req.body.folderId,
    description: req.body.description,
    category: req.body.category,
    tags,
  });
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'document.upload', resourceType: 'document', resourceId: document.id });
  res.status(201).json({ success: true, data: document });
});

export const bulkUpload = asyncHandler(async (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) throw ApiError.badRequest('No files uploaded');
  const results = [];
  for (const file of files) {
    const document = await service.uploadDocument(req.user!.organizationId, req.user!.sub, file, { folderId: req.body.folderId });
    results.push(document);
  }
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'document.bulk_upload', metadata: { count: files.length } });
  res.status(201).json({ success: true, data: results });
});

export const listDocuments = asyncHandler(async (req: Request, res: Response) => {
  const { folderId, status, category, page, pageSize } = req.query;
  const result = await service.listDocuments(req.user!.organizationId, {
    folderId: folderId === 'root' ? null : (folderId as string | undefined),
    status: status as string,
    category: category as string,
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined,
  });
  res.json({ success: true, data: result });
});

export const getDocument = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.getDocument(req.user!.organizationId, req.params.documentId) });
});

export const downloadDocument = asyncHandler(async (req: Request, res: Response) => {
  const watermark = req.query.watermark === 'true';
  const requester = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.sub } });
  const { buffer, mimeType, filename, document } = await service.downloadDocument(req.user!.organizationId, req.params.documentId, {
    watermarkUserEmail: watermark ? requester.email : undefined,
  });
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'document.download', resourceType: 'document', resourceId: document.id });
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.send(buffer);
});

export const updateDocument = asyncHandler(async (req: Request, res: Response) => {
  const document = await service.updateDocument(req.user!.organizationId, req.params.documentId, req.body);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'document.update', resourceType: 'document', resourceId: document.id });
  res.json({ success: true, data: document });
});

export const moveDocument = asyncHandler(async (req: Request, res: Response) => {
  const document = await service.moveDocument(req.user!.organizationId, req.params.documentId, req.body.folderId ?? null);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'document.move', resourceType: 'document', resourceId: document.id });
  res.json({ success: true, data: document });
});

export const copyDocument = asyncHandler(async (req: Request, res: Response) => {
  const document = await service.copyDocument(req.user!.organizationId, req.params.documentId, req.user!.sub, req.body.folderId);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'document.copy', resourceType: 'document', resourceId: document.id });
  res.status(201).json({ success: true, data: document });
});

export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
  await service.softDeleteDocument(req.user!.organizationId, req.params.documentId);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'document.delete', resourceType: 'document', resourceId: req.params.documentId });
  res.json({ success: true });
});

export const restoreDocument = asyncHandler(async (req: Request, res: Response) => {
  const document = await service.restoreDocument(req.user!.organizationId, req.params.documentId);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'document.restore', resourceType: 'document', resourceId: document.id });
  res.json({ success: true, data: document });
});

export const permanentlyDeleteDocument = asyncHandler(async (req: Request, res: Response) => {
  await service.permanentlyDeleteDocument(req.user!.organizationId, req.params.documentId);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'document.permanent_delete', resourceType: 'document', resourceId: req.params.documentId });
  res.json({ success: true });
});

export const listRecycleBin = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listDocuments(req.user!.organizationId, { status: 'recycled', page: Number(req.query.page) || 1, pageSize: Number(req.query.pageSize) || 25 });
  res.json({ success: true, data: result });
});

export const checkOutDocument = asyncHandler(async (req: Request, res: Response) => {
  const document = await service.checkOutDocument(req.user!.organizationId, req.params.documentId, req.user!.sub);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'document.checkout', resourceType: 'document', resourceId: document.id });
  res.json({ success: true, data: document });
});

export const checkInDocument = asyncHandler(async (req: Request, res: Response) => {
  const document = await service.checkInDocument(req.user!.organizationId, req.params.documentId, req.user!.sub);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'document.checkin', resourceType: 'document', resourceId: document.id });
  res.json({ success: true, data: document });
});

export const uploadNewVersion = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded');
  const document = await service.uploadNewVersion(req.user!.organizationId, req.params.documentId, req.user!.sub, req.file, req.body.comment);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'document.new_version', resourceType: 'document', resourceId: document.id });
  res.status(201).json({ success: true, data: document });
});

export const listVersions = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.listVersions(req.user!.organizationId, req.params.documentId) });
});

export const restoreVersion = asyncHandler(async (req: Request, res: Response) => {
  const document = await service.restoreVersion(req.user!.organizationId, req.params.documentId, Number(req.params.versionNumber), req.user!.sub);
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'document.version.restore', resourceType: 'document', resourceId: document.id });
  res.json({ success: true, data: document });
});

export const compareVersions = asyncHandler(async (req: Request, res: Response) => {
  const { v1, v2 } = req.query;
  const result = await service.compareVersions(req.user!.organizationId, req.params.documentId, Number(v1), Number(v2));
  res.json({ success: true, data: result });
});

export const toggleFavorite = asyncHandler(async (req: Request, res: Response) => {
  await service.toggleFavorite(req.user!.sub, req.params.documentId, req.body.favorite !== false);
  res.json({ success: true });
});

export const listFavorites = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.listFavorites(req.user!.organizationId, req.user!.sub) });
});

export const addComment = asyncHandler(async (req: Request, res: Response) => {
  const { comment, mentionedEmails } = await service.addComment(req.params.documentId, req.user!.sub, req.body.body, req.body.parentId);

  if (mentionedEmails.length) {
    const mentionedUsers = await prisma.user.findMany({ where: { organizationId: req.user!.organizationId, email: { in: mentionedEmails } } });
    await Promise.all(
      mentionedUsers.map((u) =>
        createNotification(req.user!.organizationId, u.id, 'mention', 'You were mentioned in a comment', comment.body),
      ),
    );
  }

  res.status(201).json({ success: true, data: comment });
});

export const addTags = asyncHandler(async (req: Request, res: Response) => {
  const tags = await service.addTags(req.user!.organizationId, req.params.documentId, req.body.tags);
  res.status(201).json({ success: true, data: tags });
});

export const removeTag = asyncHandler(async (req: Request, res: Response) => {
  await service.removeTag(req.params.documentId, req.params.tagId);
  res.json({ success: true });
});

export const listOrgTags = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.listOrgTags(req.user!.organizationId) });
});

export const addMetadataField = asyncHandler(async (req: Request, res: Response) => {
  const field = await service.addMetadataField(req.params.documentId, req.body.fieldName, req.body.fieldValue);
  res.status(201).json({ success: true, data: field });
});

export const createShareLink = asyncHandler(async (req: Request, res: Response) => {
  const { password, viewOnly, maxDownloads, expiresAt } = req.body;
  const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
  const link = await service.createShareLink(req.params.documentId, { passwordHash, viewOnly, maxDownloads, expiresAt });
  await recordAudit(req, { organizationId: req.user!.organizationId, userId: req.user!.sub, action: 'document.share_link.create', resourceType: 'document', resourceId: req.params.documentId });
  res.status(201).json({ success: true, data: { ...link, url: `${req.protocol}://${req.get('host')}/api/v1/documents/shared/${link.token}` } });
});

export const listShareLinks = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await service.listShareLinks(req.params.documentId) });
});

export const revokeShareLink = asyncHandler(async (req: Request, res: Response) => {
  await service.revokeShareLink(req.user!.organizationId, req.params.documentId, req.params.linkId);
  res.json({ success: true });
});

// Public (unauthenticated) share-link access
export const accessSharedDocument = asyncHandler(async (req: Request, res: Response) => {
  const link = await service.getShareLinkByToken(req.params.token);

  if (link.passwordHash) {
    const provided = (req.query.password as string) ?? req.body?.password;
    if (!provided || !(await bcrypt.compare(provided, link.passwordHash))) {
      throw ApiError.unauthorized('Password required or incorrect for this share link');
    }
  }

  const { buffer, mimeType, filename } = await service.downloadDocument(link.document.organizationId, link.documentId);
  await service.incrementShareLinkDownload(link.id);

  res.setHeader('Content-Type', mimeType);
  if (!link.viewOnly) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  }
  res.send(buffer);
});
