import { v4 as uuid } from 'uuid';
import path from 'path';
import { Prisma } from '@prisma/client';
import { PDFDocument, rgb } from 'pdf-lib';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { storage, computeChecksum, encryptBuffer, decryptBuffer } from '../../utils/storage';
import { extractText } from '../search/ocr.service';
import { logger } from '../../config/logger';

function fileTypeFromMime(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('word')) return 'word';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'excel';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'powerpoint';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'text/csv') return 'csv';
  if (mimeType.startsWith('text/')) return 'text';
  if (mimeType.includes('zip') || mimeType.includes('rar')) return 'archive';
  if (mimeType.includes('json')) return 'json';
  if (mimeType.includes('xml')) return 'xml';
  if (mimeType === 'message/rfc822') return 'email';
  if (mimeType.includes('epub') || mimeType.includes('mobipocket')) return 'ebook';
  return 'other';
}

function buildStorageKey(organizationId: string, documentId: string, version: number, originalName: string) {
  const ext = path.extname(originalName);
  return `org_${organizationId}/doc_${documentId}/v${version}_${uuid()}${ext}`;
}

async function runOcrInBackground(documentId: string, buffer: Buffer, mimeType: string) {
  extractText(buffer, mimeType)
    .then(async (text) => {
      if (text) {
        await prisma.document.update({ where: { id: documentId }, data: { ocrText: text } });
      }
    })
    .catch((err) => logger.warn('Background OCR failed', { documentId, error: err.message }));
}

export async function checkDuplicate(organizationId: string, checksum: string) {
  return prisma.document.findFirst({ where: { organizationId, checksum, deletedAt: null } });
}

export async function uploadDocument(
  organizationId: string,
  userId: string,
  file: Express.Multer.File,
  meta: { folderId?: string; description?: string; category?: string; tags?: string[] },
) {
  const checksum = computeChecksum(file.buffer);
  const duplicate = await checkDuplicate(organizationId, checksum);

  const document = await prisma.document.create({
    data: {
      organizationId,
      folderId: meta.folderId,
      name: file.originalname,
      description: meta.description,
      category: meta.category,
      fileType: fileTypeFromMime(file.mimetype),
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storageKey: 'pending',
      checksum,
      createdById: userId,
    },
  });

  const storageKey = buildStorageKey(organizationId, document.id, 1, file.originalname);
  await storage.put(storageKey, encryptBuffer(file.buffer));

  await prisma.$transaction([
    prisma.document.update({ where: { id: document.id }, data: { storageKey } }),
    prisma.documentVersion.create({
      data: {
        documentId: document.id,
        versionNumber: 1,
        storageKey,
        sizeBytes: file.size,
        checksum,
        createdById: userId,
        comment: 'Initial upload',
      },
    }),
    prisma.organization.update({
      where: { id: organizationId },
      data: { storageUsedBytes: { increment: file.size } },
    }),
  ]);

  if (meta.tags?.length) {
    await attachTags(organizationId, document.id, meta.tags);
  }

  runOcrInBackground(document.id, file.buffer, file.mimetype);

  return { ...document, storageKey, isDuplicateOf: duplicate?.id ?? null };
}

async function attachTags(organizationId: string, documentId: string, tagNames: string[]) {
  for (const name of tagNames) {
    const tag = await prisma.tag.upsert({
      where: { organizationId_name: { organizationId, name } },
      update: {},
      create: { organizationId, name },
    });
    await prisma.documentTag.upsert({
      where: { documentId_tagId: { documentId, tagId: tag.id } },
      update: {},
      create: { documentId, tagId: tag.id },
    });
  }
}

export async function listDocuments(
  organizationId: string,
  filters: { folderId?: string | null; status?: string; category?: string; page?: number; pageSize?: number },
) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;

  const where: Prisma.DocumentWhereInput = {
    organizationId,
    deletedAt: filters.status === 'recycled' ? { not: null } : null,
    ...(filters.folderId !== undefined ? { folderId: filters.folderId } : {}),
    ...(filters.category ? { category: filters.category } : {}),
  };

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: {
        tags: { include: { tag: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { comments: true, versions: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.document.count({ where }),
  ]);

  return { documents, total, page, pageSize };
}

export async function getDocument(organizationId: string, documentId: string) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId },
    include: {
      tags: { include: { tag: true } },
      metadataFields: true,
      versions: { orderBy: { versionNumber: 'desc' } },
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      comments: { include: { user: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!document) throw ApiError.notFound('Document not found');
  return document;
}

export async function downloadDocument(organizationId: string, documentId: string, options: { watermarkUserEmail?: string } = {}) {
  const document = await prisma.document.findFirst({ where: { id: documentId, organizationId } });
  if (!document) throw ApiError.notFound('Document not found');

  const encrypted = await storage.get(document.storageKey);
  let buffer = decryptBuffer(encrypted);

  if (options.watermarkUserEmail && document.mimeType === 'application/pdf') {
    buffer = await applyPdfWatermark(buffer, options.watermarkUserEmail);
  }

  return { buffer, mimeType: document.mimeType, filename: document.name, document };
}

async function applyPdfWatermark(buffer: Buffer, text: string): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(buffer);
  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const { width, height } = page.getSize();
    page.drawText(`${text} - ${new Date().toISOString()}`, {
      x: width / 2 - 150,
      y: height / 2,
      size: 16,
      color: rgb(0.75, 0.75, 0.75),
      opacity: 0.4,
      rotate: { type: 'degrees', angle: 45 } as never,
    });
  }
  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

export async function updateDocument(
  organizationId: string,
  documentId: string,
  data: { name?: string; description?: string; category?: string; documentNumber?: string; confidentiality?: string },
) {
  const document = await prisma.document.findFirst({ where: { id: documentId, organizationId } });
  if (!document) throw ApiError.notFound('Document not found');
  if (document.isLocked) throw ApiError.conflict('Document is checked out and locked for editing');
  return prisma.document.update({ where: { id: documentId }, data: data as never });
}

export async function moveDocument(organizationId: string, documentId: string, folderId: string | null) {
  const document = await prisma.document.findFirst({ where: { id: documentId, organizationId } });
  if (!document) throw ApiError.notFound('Document not found');
  return prisma.document.update({ where: { id: documentId }, data: { folderId } });
}

export async function copyDocument(organizationId: string, documentId: string, userId: string, targetFolderId?: string | null) {
  const original = await prisma.document.findFirst({ where: { id: documentId, organizationId } });
  if (!original) throw ApiError.notFound('Document not found');

  const encrypted = await storage.get(original.storageKey);

  const copy = await prisma.document.create({
    data: {
      organizationId,
      folderId: targetFolderId ?? original.folderId,
      name: `Copy of ${original.name}`,
      description: original.description,
      category: original.category,
      fileType: original.fileType,
      mimeType: original.mimeType,
      sizeBytes: original.sizeBytes,
      storageKey: 'pending',
      checksum: original.checksum,
      createdById: userId,
    },
  });

  const newKey = buildStorageKey(organizationId, copy.id, 1, original.name);
  await storage.put(newKey, encrypted);

  await prisma.$transaction([
    prisma.document.update({ where: { id: copy.id }, data: { storageKey: newKey } }),
    prisma.documentVersion.create({
      data: { documentId: copy.id, versionNumber: 1, storageKey: newKey, sizeBytes: original.sizeBytes, checksum: original.checksum, createdById: userId, comment: `Copied from ${original.id}` },
    }),
  ]);

  return copy;
}

export async function softDeleteDocument(organizationId: string, documentId: string) {
  const document = await prisma.document.findFirst({ where: { id: documentId, organizationId } });
  if (!document) throw ApiError.notFound('Document not found');
  return prisma.document.update({ where: { id: documentId }, data: { deletedAt: new Date(), status: 'RECYCLED' } });
}

export async function restoreDocument(organizationId: string, documentId: string) {
  const document = await prisma.document.findFirst({ where: { id: documentId, organizationId } });
  if (!document) throw ApiError.notFound('Document not found');
  return prisma.document.update({ where: { id: documentId }, data: { deletedAt: null, status: 'ACTIVE' } });
}

export async function permanentlyDeleteDocument(organizationId: string, documentId: string) {
  const document = await prisma.document.findFirst({ where: { id: documentId, organizationId } });
  if (!document) throw ApiError.notFound('Document not found');
  if (!document.deletedAt) throw ApiError.badRequest('Document must be in the recycle bin before permanent deletion');

  const versions = await prisma.documentVersion.findMany({ where: { documentId } });
  await Promise.all(versions.map((v) => storage.delete(v.storageKey).catch(() => undefined)));

  await prisma.document.delete({ where: { id: documentId } });
}

export async function checkOutDocument(organizationId: string, documentId: string, userId: string) {
  const document = await prisma.document.findFirst({ where: { id: documentId, organizationId } });
  if (!document) throw ApiError.notFound('Document not found');
  if (document.isLocked) throw ApiError.conflict(`Document is already checked out by another user`);
  return prisma.document.update({ where: { id: documentId }, data: { isLocked: true, lockedById: userId, lockedAt: new Date() } });
}

export async function checkInDocument(organizationId: string, documentId: string, userId: string) {
  const document = await prisma.document.findFirst({ where: { id: documentId, organizationId } });
  if (!document) throw ApiError.notFound('Document not found');
  if (!document.isLocked) throw ApiError.badRequest('Document is not checked out');
  if (document.lockedById !== userId) throw ApiError.forbidden('Only the user who checked out this document can check it back in');
  return prisma.document.update({ where: { id: documentId }, data: { isLocked: false, lockedById: null, lockedAt: null } });
}

export async function uploadNewVersion(
  organizationId: string,
  documentId: string,
  userId: string,
  file: Express.Multer.File,
  comment?: string,
) {
  const document = await prisma.document.findFirst({ where: { id: documentId, organizationId } });
  if (!document) throw ApiError.notFound('Document not found');
  if (document.isLocked && document.lockedById !== userId) {
    throw ApiError.conflict('Document is checked out by another user');
  }

  const nextVersion = document.currentVersion + 1;
  const checksum = computeChecksum(file.buffer);
  const storageKey = buildStorageKey(organizationId, documentId, nextVersion, file.originalname);
  await storage.put(storageKey, encryptBuffer(file.buffer));

  await prisma.$transaction([
    prisma.documentVersion.create({
      data: { documentId, versionNumber: nextVersion, storageKey, sizeBytes: file.size, checksum, createdById: userId, comment },
    }),
    prisma.document.update({
      where: { id: documentId },
      data: { currentVersion: nextVersion, storageKey, sizeBytes: file.size, checksum, isLocked: false, lockedById: null, lockedAt: null },
    }),
  ]);

  runOcrInBackground(documentId, file.buffer, file.mimetype);

  return prisma.document.findUniqueOrThrow({ where: { id: documentId } });
}

export async function listVersions(organizationId: string, documentId: string) {
  const document = await prisma.document.findFirst({ where: { id: documentId, organizationId } });
  if (!document) throw ApiError.notFound('Document not found');
  return prisma.documentVersion.findMany({
    where: { documentId },
    include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { versionNumber: 'desc' },
  });
}

export async function restoreVersion(organizationId: string, documentId: string, versionNumber: number, userId: string) {
  const document = await prisma.document.findFirst({ where: { id: documentId, organizationId } });
  if (!document) throw ApiError.notFound('Document not found');

  const targetVersion = await prisma.documentVersion.findUnique({ where: { documentId_versionNumber: { documentId, versionNumber } } });
  if (!targetVersion) throw ApiError.notFound('Version not found');

  const nextVersion = document.currentVersion + 1;
  const encrypted = await storage.get(targetVersion.storageKey);
  const newKey = buildStorageKey(organizationId, documentId, nextVersion, document.name);
  await storage.put(newKey, encrypted);

  await prisma.$transaction([
    prisma.documentVersion.create({
      data: {
        documentId,
        versionNumber: nextVersion,
        storageKey: newKey,
        sizeBytes: targetVersion.sizeBytes,
        checksum: targetVersion.checksum,
        createdById: userId,
        comment: `Restored from version ${versionNumber}`,
      },
    }),
    prisma.document.update({
      where: { id: documentId },
      data: { currentVersion: nextVersion, storageKey: newKey, sizeBytes: targetVersion.sizeBytes, checksum: targetVersion.checksum },
    }),
  ]);

  return prisma.document.findUniqueOrThrow({ where: { id: documentId } });
}

export async function compareVersions(organizationId: string, documentId: string, v1: number, v2: number) {
  const document = await prisma.document.findFirst({ where: { id: documentId, organizationId } });
  if (!document) throw ApiError.notFound('Document not found');

  const [version1, version2] = await Promise.all([
    prisma.documentVersion.findUnique({ where: { documentId_versionNumber: { documentId, versionNumber: v1 } } }),
    prisma.documentVersion.findUnique({ where: { documentId_versionNumber: { documentId, versionNumber: v2 } } }),
  ]);
  if (!version1 || !version2) throw ApiError.notFound('One or both versions not found');

  return {
    version1,
    version2,
    sizeDeltaBytes: Number(version2.sizeBytes) - Number(version1.sizeBytes),
    checksumChanged: version1.checksum !== version2.checksum,
    timeBetween: version2.createdAt.getTime() - version1.createdAt.getTime(),
  };
}

export async function toggleFavorite(userId: string, documentId: string, favorite: boolean) {
  if (favorite) {
    await prisma.favorite.upsert({ where: { userId_documentId: { userId, documentId } }, update: {}, create: { userId, documentId } });
  } else {
    await prisma.favorite.deleteMany({ where: { userId, documentId } });
  }
}

export async function listFavorites(organizationId: string, userId: string) {
  return prisma.document.findMany({
    where: { organizationId, deletedAt: null, favorites: { some: { userId } } },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function addComment(documentId: string, userId: string, body: string, parentId?: string) {
  const comment = await prisma.comment.create({ data: { documentId, userId, body, parentId } });
  const mentioned = Array.from(body.matchAll(/@([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)/g)).map((m) => m[1]);
  return { comment, mentionedEmails: mentioned };
}

export async function addTags(organizationId: string, documentId: string, tagNames: string[]) {
  await attachTags(organizationId, documentId, tagNames);
  return prisma.documentTag.findMany({ where: { documentId }, include: { tag: true } });
}

export async function removeTag(documentId: string, tagId: string) {
  await prisma.documentTag.deleteMany({ where: { documentId, tagId } });
}

export async function listOrgTags(organizationId: string) {
  return prisma.tag.findMany({ where: { organizationId }, orderBy: { name: 'asc' } });
}

export async function addMetadataField(documentId: string, fieldName: string, fieldValue: string) {
  return prisma.documentMetadata.create({ data: { documentId, fieldName, fieldValue } });
}

export async function createShareLink(
  documentId: string,
  data: { passwordHash?: string; viewOnly?: boolean; maxDownloads?: number; expiresAt?: string },
) {
  const token = uuid().replace(/-/g, '');
  return prisma.shareLink.create({
    data: {
      documentId,
      token,
      passwordHash: data.passwordHash,
      viewOnly: data.viewOnly ?? false,
      maxDownloads: data.maxDownloads,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    },
  });
}

export async function getShareLinkByToken(token: string) {
  const link = await prisma.shareLink.findUnique({ where: { token }, include: { document: true } });
  if (!link) throw ApiError.notFound('Share link not found');
  if (link.expiresAt && link.expiresAt < new Date()) throw ApiError.forbidden('This share link has expired');
  if (link.maxDownloads && link.downloadCount >= link.maxDownloads) throw ApiError.forbidden('Download limit reached for this link');
  return link;
}

export async function incrementShareLinkDownload(id: string) {
  await prisma.shareLink.update({ where: { id }, data: { downloadCount: { increment: 1 } } });
}

export async function revokeShareLink(organizationId: string, documentId: string, linkId: string) {
  const document = await prisma.document.findFirst({ where: { id: documentId, organizationId } });
  if (!document) throw ApiError.notFound('Document not found');
  await prisma.shareLink.deleteMany({ where: { id: linkId, documentId } });
}

export async function listShareLinks(documentId: string) {
  return prisma.shareLink.findMany({ where: { documentId }, orderBy: { createdAt: 'desc' } });
}
