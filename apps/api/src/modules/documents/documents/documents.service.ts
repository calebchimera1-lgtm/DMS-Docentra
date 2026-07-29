import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CheckInDto } from "./dto/check-in.dto";
import type { CreateDocumentDto } from "./dto/create-document.dto";
import type { ListDocumentsQueryDto } from "./dto/list-documents-query.dto";
import type { UpdateDocumentDto } from "./dto/update-document.dto";

const EXPORT_ROW_LIMIT = 5000;

const documentInclude = {
  folder: { select: { id: true, name: true } },
  checkedOutBy: { select: { id: true, firstName: true, lastName: true } },
  owner: { select: { id: true, firstName: true, lastName: true } },
  versions: {
    orderBy: { versionNumber: "desc" },
    select: {
      id: true,
      versionNumber: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      note: true,
      createdAt: true,
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} as const;

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(
    companyId: string,
    query: Pick<ListDocumentsQueryDto, "search" | "status" | "folderId" | "checkedOutOnly">,
  ) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" as const } },
              { description: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.folderId ? { folderId: query.folderId } : {}),
      ...(query.checkedOutOnly ? { checkedOutById: { not: null } } : {}),
    };
  }

  async list(companyId: string, query: ListDocumentsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: documentInclude,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.document.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, companyId, deletedAt: null },
      include: documentInclude,
    });
    if (!document) {
      throw new NotFoundException("Document not found");
    }
    return document;
  }

  private async assertFolderBelongsToCompany(companyId: string, folderId: string): Promise<void> {
    const count = await this.prisma.documentFolder.count({
      where: { id: folderId, companyId, deletedAt: null },
    });
    if (count === 0) {
      throw new BadRequestException("Folder does not belong to this company");
    }
  }

  /**
   * Creating a document always writes version 1 alongside it — a document
   * with no revisions would be a file that does not exist yet, and every
   * later revision arrives through check-in.
   */
  async create(companyId: string, userId: string, dto: CreateDocumentDto) {
    if (dto.folderId) {
      await this.assertFolderBelongsToCompany(companyId, dto.folderId);
    }

    return this.prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          companyId,
          folderId: dto.folderId,
          title: dto.title,
          description: dto.description,
          ownerId: userId,
          currentVersionNumber: 1,
        },
      });

      await tx.documentVersion.create({
        data: {
          companyId,
          documentId: document.id,
          versionNumber: 1,
          fileName: dto.fileName,
          mimeType: dto.mimeType,
          sizeBytes: dto.sizeBytes,
          storageKey: dto.storageKey,
          note: dto.note ?? "Initial version",
          createdById: userId,
        },
      });

      return tx.document.findUniqueOrThrow({ where: { id: document.id }, include: documentInclude });
    });
  }

  /** Metadata only, and never while someone else holds the lock. */
  async update(companyId: string, userId: string, id: string, dto: UpdateDocumentDto) {
    const document = await this.findOne(companyId, id);
    this.assertNotLockedByAnotherUser(document, userId);
    if (dto.folderId) {
      await this.assertFolderBelongsToCompany(companyId, dto.folderId);
    }
    return this.prisma.document.update({
      where: { id },
      data: { title: dto.title, folderId: dto.folderId, description: dto.description },
      include: documentInclude,
    });
  }

  private assertNotLockedByAnotherUser(
    document: { checkedOutById: string | null; checkedOutBy: { firstName: string; lastName: string } | null },
    userId: string,
  ): void {
    if (document.checkedOutById && document.checkedOutById !== userId) {
      const holder = document.checkedOutBy
        ? `${document.checkedOutBy.firstName} ${document.checkedOutBy.lastName}`
        : "another user";
      throw new ConflictException(`This document is checked out by ${holder}`);
    }
  }

  /**
   * Takes the exclusive edit lock. Returns 409 rather than 400 when
   * someone else already holds it: the request is well-formed and would
   * succeed once the other user checks in, which is exactly what a
   * conflict means.
   */
  async checkOut(companyId: string, userId: string, id: string) {
    const document = await this.findOne(companyId, id);
    if (document.status === "ARCHIVED") {
      throw new BadRequestException("An archived document cannot be checked out");
    }
    if (document.checkedOutById === userId) {
      throw new BadRequestException("You already have this document checked out");
    }
    this.assertNotLockedByAnotherUser(document, userId);

    return this.prisma.document.update({
      where: { id },
      data: { checkedOutById: userId, checkedOutAt: new Date() },
      include: documentInclude,
    });
  }

  /**
   * Appends the next version and releases the lock, in one transaction so
   * a document can never end up unlocked without its new revision (or the
   * reverse). Only the lock holder may check in.
   */
  async checkIn(companyId: string, userId: string, id: string, dto: CheckInDto) {
    const document = await this.findOne(companyId, id);
    if (!document.checkedOutById) {
      throw new BadRequestException("This document is not checked out");
    }
    if (document.checkedOutById !== userId) {
      this.assertNotLockedByAnotherUser(document, userId);
    }

    const nextVersion = document.currentVersionNumber + 1;

    return this.prisma.$transaction(async (tx) => {
      await tx.documentVersion.create({
        data: {
          companyId,
          documentId: id,
          versionNumber: nextVersion,
          fileName: dto.fileName,
          mimeType: dto.mimeType,
          sizeBytes: dto.sizeBytes,
          storageKey: dto.storageKey,
          note: dto.note,
          createdById: userId,
        },
      });

      await tx.document.update({
        where: { id },
        data: { currentVersionNumber: nextVersion, checkedOutById: null, checkedOutAt: null },
      });

      return tx.document.findUniqueOrThrow({ where: { id }, include: documentInclude });
    });
  }

  /** Releases the lock without adding a revision — the "never mind" path. */
  async cancelCheckOut(companyId: string, userId: string, id: string) {
    const document = await this.findOne(companyId, id);
    if (!document.checkedOutById) {
      throw new BadRequestException("This document is not checked out");
    }
    this.assertNotLockedByAnotherUser(document, userId);

    return this.prisma.document.update({
      where: { id },
      data: { checkedOutById: null, checkedOutAt: null },
      include: documentInclude,
    });
  }

  async publish(companyId: string, userId: string, id: string) {
    const document = await this.findOne(companyId, id);
    if (document.status !== "DRAFT") {
      throw new BadRequestException("Only a draft document can be published");
    }
    if (document.checkedOutById) {
      throw new BadRequestException("Check the document in before publishing it");
    }
    this.assertNotLockedByAnotherUser(document, userId);

    return this.prisma.document.update({ where: { id }, data: { status: "PUBLISHED" }, include: documentInclude });
  }

  async archive(companyId: string, userId: string, id: string) {
    const document = await this.findOne(companyId, id);
    if (document.status === "ARCHIVED") {
      throw new BadRequestException("This document is already archived");
    }
    if (document.checkedOutById) {
      throw new BadRequestException("Check the document in before archiving it");
    }
    this.assertNotLockedByAnotherUser(document, userId);

    return this.prisma.document.update({ where: { id }, data: { status: "ARCHIVED" }, include: documentInclude });
  }

  async restore(companyId: string, id: string) {
    const document = await this.findOne(companyId, id);
    if (document.status !== "ARCHIVED") {
      throw new BadRequestException("Only an archived document can be restored");
    }
    return this.prisma.document.update({ where: { id }, data: { status: "PUBLISHED" }, include: documentInclude });
  }

  async remove(companyId: string, id: string): Promise<void> {
    const document = await this.findOne(companyId, id);
    if (document.checkedOutById) {
      throw new ForbiddenException("A checked-out document cannot be deleted");
    }
    if (document.status === "PUBLISHED") {
      throw new ForbiddenException("Archive the document before deleting it");
    }
    await this.prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListDocumentsQueryDto, "search" | "status" | "folderId" | "checkedOutOnly">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.document.findMany({
      where,
      include: documentInclude,
      orderBy: { updatedAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      title: r.title,
      status: r.status,
      folder: r.folder?.name ?? "",
      version: r.currentVersionNumber,
      checkedOutBy: r.checkedOutBy ? `${r.checkedOutBy.firstName} ${r.checkedOutBy.lastName}` : "",
      owner: r.owner ? `${r.owner.firstName} ${r.owner.lastName}` : "",
      updatedAt: r.updatedAt,
    }));
    return toCsv(flat, ["title", "status", "folder", "version", "checkedOutBy", "owner", "updatedAt"]);
  }
}
