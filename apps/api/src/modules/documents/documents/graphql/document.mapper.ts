import type { DocumentItemType } from "./document.type";

interface PrismaUserRef {
  id: string;
  firstName: string;
  lastName: string;
}

interface PrismaDocumentWithRelations {
  id: string;
  title: string;
  status: string;
  description: string | null;
  currentVersionNumber: number;
  folder: { id: string; name: string } | null;
  checkedOutBy: PrismaUserRef | null;
  owner: PrismaUserRef | null;
  versions: {
    id: string;
    versionNumber: number;
    fileName: string;
    mimeType: string | null;
    sizeBytes: number | null;
    note: string | null;
    createdAt: Date;
    createdBy: PrismaUserRef | null;
  }[];
}

export function toDocumentItemType(document: PrismaDocumentWithRelations): DocumentItemType {
  return {
    id: document.id,
    title: document.title,
    status: document.status,
    description: document.description ?? undefined,
    currentVersionNumber: document.currentVersionNumber,
    folder: document.folder ?? undefined,
    checkedOutBy: document.checkedOutBy ?? undefined,
    owner: document.owner ?? undefined,
    versions: document.versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      fileName: v.fileName,
      mimeType: v.mimeType ?? undefined,
      sizeBytes: v.sizeBytes ?? undefined,
      note: v.note ?? undefined,
      createdAt: v.createdAt,
      createdBy: v.createdBy ?? undefined,
    })),
  };
}
