import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CreateProjectDto } from "./dto/create-project.dto";
import type { ListProjectsQueryDto } from "./dto/list-projects-query.dto";
import type { UpdateProjectDto } from "./dto/update-project.dto";

const EXPORT_ROW_LIMIT = 5000;

const projectInclude = {
  account: { select: { id: true, name: true } },
  owner: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListProjectsQueryDto, "search" | "status" | "accountId">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" as const } },
              { code: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
    };
  }

  private async assertAccountBelongsToCompany(companyId: string, accountId: string): Promise<void> {
    const account = await this.prisma.crmAccount.findFirst({ where: { id: accountId, companyId, deletedAt: null } });
    if (!account) {
      throw new BadRequestException("Account does not belong to this company");
    }
  }

  private async assertOwnerBelongsToCompany(companyId: string, ownerId: string): Promise<void> {
    const owner = await this.prisma.user.findFirst({ where: { id: ownerId, companyId, deletedAt: null } });
    if (!owner) {
      throw new BadRequestException("Owner does not belong to this company");
    }
  }

  async list(companyId: string, query: ListProjectsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        include: projectInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.project.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, companyId, deletedAt: null },
      include: projectInclude,
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }
    return project;
  }

  async create(companyId: string, dto: CreateProjectDto) {
    const existing = await this.prisma.project.findFirst({
      where: { companyId, code: dto.code, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException("A project with this code already exists");
    }
    if (dto.accountId) {
      await this.assertAccountBelongsToCompany(companyId, dto.accountId);
    }
    if (dto.ownerId) {
      await this.assertOwnerBelongsToCompany(companyId, dto.ownerId);
    }

    return this.prisma.project.create({
      data: {
        companyId,
        name: dto.name,
        code: dto.code,
        description: dto.description,
        status: dto.status,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        budgetCents: dto.budgetCents,
        currency: dto.currency,
        accountId: dto.accountId,
        ownerId: dto.ownerId,
      },
      include: projectInclude,
    });
  }

  async update(companyId: string, id: string, dto: UpdateProjectDto) {
    await this.findOne(companyId, id);
    if (dto.code) {
      const existing = await this.prisma.project.findFirst({
        where: { companyId, code: dto.code, deletedAt: null, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException("A project with this code already exists");
      }
    }
    if (dto.accountId) {
      await this.assertAccountBelongsToCompany(companyId, dto.accountId);
    }
    if (dto.ownerId) {
      await this.assertOwnerBelongsToCompany(companyId, dto.ownerId);
    }

    return this.prisma.project.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: projectInclude,
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.findOne(companyId, id);
    const taskCount = await this.prisma.projectTask.count({ where: { projectId: id, deletedAt: null } });
    if (taskCount > 0) {
      throw new ForbiddenException("Cannot delete a project that still has tasks — delete or reassign them first");
    }
    await this.prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListProjectsQueryDto, "search" | "status" | "accountId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.project.findMany({
      where,
      include: projectInclude,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      code: r.code,
      name: r.name,
      status: r.status,
      account: r.account?.name ?? "",
      owner: r.owner ? `${r.owner.firstName} ${r.owner.lastName}` : "",
      startDate: r.startDate ?? "",
      endDate: r.endDate ?? "",
    }));
    return toCsv(flat, ["code", "name", "status", "account", "owner", "startDate", "endDate"]);
  }
}
