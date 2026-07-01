import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';

export interface SearchFilters {
  q?: string;
  fileType?: string;
  tag?: string;
  category?: string;
  departmentId?: string;
  authorId?: string;
  folderId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export async function searchDocuments(organizationId: string, filters: SearchFilters) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;

  const where: Prisma.DocumentWhereInput = {
    organizationId,
    deletedAt: null,
    ...(filters.fileType ? { fileType: filters.fileType } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.folderId ? { folderId: filters.folderId } : {}),
    ...(filters.authorId ? { createdById: filters.authorId } : {}),
    ...(filters.tag ? { tags: { some: { tag: { name: filters.tag } } } } : {}),
    ...(filters.departmentId ? { createdBy: { departmentId: filters.departmentId } } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          createdAt: {
            ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
            ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
          },
        }
      : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: 'insensitive' } },
            { description: { contains: filters.q, mode: 'insensitive' } },
            { ocrText: { contains: filters.q, mode: 'insensitive' } },
            { documentNumber: { contains: filters.q, mode: 'insensitive' } },
            { createdBy: { firstName: { contains: filters.q, mode: 'insensitive' } } },
            { createdBy: { lastName: { contains: filters.q, mode: 'insensitive' } } },
            { tags: { some: { tag: { name: { contains: filters.q, mode: 'insensitive' } } } } },
          ],
        }
      : {}),
  };

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: { tags: { include: { tag: true } }, createdBy: { select: { firstName: true, lastName: true, email: true } }, folder: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.document.count({ where }),
  ]);

  return { documents, total, page, pageSize };
}

export async function saveSearch(organizationId: string, userId: string, name: string, query: SearchFilters) {
  return prisma.savedSearch.create({ data: { organizationId, userId, name, queryJson: query as never } });
}

export async function listSavedSearches(organizationId: string, userId: string) {
  return prisma.savedSearch.findMany({ where: { organizationId, userId }, orderBy: { createdAt: 'desc' } });
}

export async function deleteSavedSearch(userId: string, id: string) {
  await prisma.savedSearch.deleteMany({ where: { id, userId } });
}
