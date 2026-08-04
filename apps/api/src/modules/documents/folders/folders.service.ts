import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CreateFolderDto } from "./dto/create-folder.dto";
import type { ListFoldersQueryDto } from "./dto/list-folders-query.dto";
import type { UpdateFolderDto } from "./dto/update-folder.dto";

const EXPORT_ROW_LIMIT = 5000;

/**
 * How far up the tree the cycle guard will walk before giving up. A
 * folder tree this deep is pathological, and refusing beyond it stops a
 * corrupted parent chain from spinning forever.
 */
const MAX_TREE_DEPTH = 64;

const folderInclude = {
  parent: { select: { id: true, name: true } },
  _count: { select: { children: true, documents: true } },
} as const;

@Injectable()
export class FoldersService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListFoldersQueryDto, "search" | "parentId" | "rootOnly">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" as const } } : {}),
      ...(query.parentId ? { parentId: query.parentId } : {}),
      ...(query.rootOnly ? { parentId: null } : {}),
    };
  }

  async list(companyId: string, query: ListFoldersQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.documentFolder.findMany({
        where,
        include: folderInclude,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.documentFolder.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const folder = await this.prisma.documentFolder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: folderInclude,
    });
    if (!folder) {
      throw new NotFoundException("Folder not found");
    }
    return folder;
  }

  private async assertParentIsUsable(companyId: string, parentId: string): Promise<void> {
    const count = await this.prisma.documentFolder.count({
      where: { id: parentId, companyId, deletedAt: null },
    });
    if (count === 0) {
      throw new BadRequestException("Parent folder does not belong to this company");
    }
  }

  /**
   * Walks up from `parentId` and refuses if `folderId` shows up — moving a
   * folder inside its own subtree would orphan that whole branch from the
   * root. Same self-reference reasoning as Manufacturing's guard against a
   * product being a component of its own BOM, but over an arbitrary depth
   * rather than a single hop.
   */
  private async assertNoCycle(companyId: string, folderId: string, parentId: string): Promise<void> {
    if (folderId === parentId) {
      throw new BadRequestException("A folder cannot be its own parent");
    }

    let cursor: string | null = parentId;
    for (let depth = 0; depth < MAX_TREE_DEPTH && cursor; depth += 1) {
      if (cursor === folderId) {
        throw new BadRequestException("A folder cannot be moved inside one of its own subfolders");
      }
      const node: { parentId: string | null } | null = await this.prisma.documentFolder.findFirst({
        where: { id: cursor, companyId, deletedAt: null },
        select: { parentId: true },
      });
      cursor = node?.parentId ?? null;
    }
  }

  async create(companyId: string, dto: CreateFolderDto) {
    if (dto.parentId) {
      await this.assertParentIsUsable(companyId, dto.parentId);
    }
    return this.prisma.documentFolder.create({
      data: {
        companyId,
        name: dto.name,
        parentId: dto.parentId,
        description: dto.description,
      },
      include: folderInclude,
    });
  }

  async update(companyId: string, id: string, dto: UpdateFolderDto) {
    await this.findOne(companyId, id);
    if (dto.parentId) {
      await this.assertParentIsUsable(companyId, dto.parentId);
      await this.assertNoCycle(companyId, id, dto.parentId);
    }
    return this.prisma.documentFolder.update({
      where: { id },
      data: {
        name: dto.name,
        parentId: dto.parentId,
        description: dto.description,
      },
      include: folderInclude,
    });
  }

  /** A folder must be empty before it can go — no orphaned subtrees or documents. */
  async remove(companyId: string, id: string): Promise<void> {
    const folder = await this.findOne(companyId, id);
    if (folder._count.children > 0) {
      throw new ForbiddenException("This folder still has subfolders");
    }
    if (folder._count.documents > 0) {
      throw new ForbiddenException("This folder still has documents");
    }
    await this.prisma.documentFolder.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListFoldersQueryDto, "search" | "parentId" | "rootOnly">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.documentFolder.findMany({
      where,
      include: folderInclude,
      orderBy: { name: "asc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      name: r.name,
      parent: r.parent?.name ?? "",
      subfolders: r._count.children,
      documents: r._count.documents,
      description: r.description ?? "",
    }));
    return toCsv(flat, ["name", "parent", "subfolders", "documents", "description"]);
  }
}
