import { Folder } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';

export async function listFolders(organizationId: string, parentId?: string | null) {
  return prisma.folder.findMany({
    where: {
      organizationId,
      deletedAt: null,
      parentId: parentId === undefined ? undefined : parentId,
    },
    orderBy: { name: 'asc' },
  });
}

export async function getFolderBreadcrumb(organizationId: string, folderId: string) {
  const breadcrumb: { id: string; name: string }[] = [];
  let currentId: string | null = folderId;
  while (currentId) {
    const folder: Folder | null = await prisma.folder.findFirst({ where: { id: currentId, organizationId } });
    if (!folder) break;
    breadcrumb.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parentId;
  }
  return breadcrumb;
}

export async function createFolder(
  organizationId: string,
  createdById: string,
  data: { name: string; parentId?: string; colorCode?: string },
) {
  let path = '';
  if (data.parentId) {
    const parent = await prisma.folder.findFirst({ where: { id: data.parentId, organizationId } });
    if (!parent) throw ApiError.notFound('Parent folder not found');
    path = parent.path;
  }

  const folder = await prisma.folder.create({
    data: {
      organizationId,
      name: data.name,
      parentId: data.parentId,
      colorCode: data.colorCode,
      createdById,
      path: 'pending',
    },
  });

  const finalPath = `${path}/${folder.id}`;
  return prisma.folder.update({ where: { id: folder.id }, data: { path: finalPath } });
}

export async function renameFolder(organizationId: string, folderId: string, name: string) {
  const folder = await prisma.folder.findFirst({ where: { id: folderId, organizationId } });
  if (!folder) throw ApiError.notFound('Folder not found');
  return prisma.folder.update({ where: { id: folderId }, data: { name } });
}

export async function moveFolder(organizationId: string, folderId: string, newParentId: string | null) {
  const folder = await prisma.folder.findFirst({ where: { id: folderId, organizationId } });
  if (!folder) throw ApiError.notFound('Folder not found');

  let newPath = '';
  if (newParentId) {
    if (newParentId === folderId) throw ApiError.badRequest('A folder cannot be moved into itself');
    const parent = await prisma.folder.findFirst({ where: { id: newParentId, organizationId } });
    if (!parent) throw ApiError.notFound('Destination folder not found');
    if (parent.path.includes(`/${folderId}`)) throw ApiError.badRequest('Cannot move a folder into its own descendant');
    newPath = parent.path;
  }

  return prisma.folder.update({
    where: { id: folderId },
    data: { parentId: newParentId, path: `${newPath}/${folderId}` },
  });
}

export async function deleteFolder(organizationId: string, folderId: string) {
  const folder = await prisma.folder.findFirst({ where: { id: folderId, organizationId } });
  if (!folder) throw ApiError.notFound('Folder not found');

  const childCount = await prisma.folder.count({ where: { parentId: folderId, deletedAt: null } });
  const docCount = await prisma.document.count({ where: { folderId, deletedAt: null } });
  if (childCount > 0 || docCount > 0) {
    throw ApiError.conflict('Folder is not empty. Move or delete its contents first.');
  }

  await prisma.folder.update({ where: { id: folderId }, data: { deletedAt: new Date() } });
}

export async function archiveFolder(organizationId: string, folderId: string, isArchive: boolean) {
  const folder = await prisma.folder.findFirst({ where: { id: folderId, organizationId } });
  if (!folder) throw ApiError.notFound('Folder not found');
  return prisma.folder.update({ where: { id: folderId }, data: { isArchive } });
}
