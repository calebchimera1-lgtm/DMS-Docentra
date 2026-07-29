import type { DocumentFolderItemType } from "./folder.type";

interface PrismaFolderWithRelations {
  id: string;
  name: string;
  description: string | null;
  parent: { id: string; name: string } | null;
  _count: { children: number; documents: number };
}

export function toDocumentFolderItemType(folder: PrismaFolderWithRelations): DocumentFolderItemType {
  return {
    id: folder.id,
    name: folder.name,
    description: folder.description ?? undefined,
    parent: folder.parent ?? undefined,
    subfolderCount: folder._count.children,
    documentCount: folder._count.documents,
  };
}
