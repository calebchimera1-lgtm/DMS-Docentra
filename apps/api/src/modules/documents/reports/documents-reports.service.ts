import { Injectable } from "@nestjs/common";
import type { DocumentStatus } from "@omniflow/database";
import { PrismaService } from "../../../prisma/prisma.service";

const DOCUMENT_STATUSES: DocumentStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

@Injectable()
export class DocumentsReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(companyId: string) {
    const base = { companyId, deletedAt: null };
    const [draftCount, publishedCount, archivedCount, checkedOutCount, folderCount, versionCount] = await Promise.all([
      this.prisma.document.count({ where: { ...base, status: "DRAFT" } }),
      this.prisma.document.count({ where: { ...base, status: "PUBLISHED" } }),
      this.prisma.document.count({ where: { ...base, status: "ARCHIVED" } }),
      this.prisma.document.count({ where: { ...base, checkedOutById: { not: null } } }),
      this.prisma.documentFolder.count({ where: base }),
      // Versions have no soft delete of their own — they live and die with
      // their document — so scope the count through the parent instead.
      this.prisma.documentVersion.count({ where: { companyId, document: { deletedAt: null } } }),
    ]);

    return { draftCount, publishedCount, archivedCount, checkedOutCount, folderCount, versionCount };
  }

  async byStatus(companyId: string) {
    const grouped = await this.prisma.document.groupBy({
      by: ["status"],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
    });
    const countByStatus = new Map(grouped.map((g) => [g.status, g._count._all]));
    return DOCUMENT_STATUSES.map((status) => ({ status, count: countByStatus.get(status) ?? 0 }));
  }
}
