import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CreateTaskDto } from "./dto/create-task.dto";
import type { ListTasksQueryDto } from "./dto/list-tasks-query.dto";
import type { UpdateTaskDto } from "./dto/update-task.dto";

const EXPORT_ROW_LIMIT = 5000;

const taskInclude = {
  project: { select: { id: true, name: true, code: true } },
  assignee: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(
    companyId: string,
    query: Pick<ListTasksQueryDto, "search" | "status" | "priority" | "projectId" | "assigneeId">,
  ) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search ? { title: { contains: query.search, mode: "insensitive" as const } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
    };
  }

  private async assertProjectBelongsToCompany(companyId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, companyId, deletedAt: null } });
    if (!project) {
      throw new BadRequestException("Project does not belong to this company");
    }
  }

  private async assertAssigneeBelongsToCompany(companyId: string, assigneeId: string): Promise<void> {
    const assignee = await this.prisma.user.findFirst({ where: { id: assigneeId, companyId, deletedAt: null } });
    if (!assignee) {
      throw new BadRequestException("Assignee does not belong to this company");
    }
  }

  async list(companyId: string, query: ListTasksQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.projectTask.findMany({
        where,
        include: taskInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.projectTask.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const task = await this.prisma.projectTask.findFirst({
      where: { id, companyId, deletedAt: null },
      include: taskInclude,
    });
    if (!task) {
      throw new NotFoundException("Task not found");
    }
    return task;
  }

  async create(companyId: string, dto: CreateTaskDto) {
    await this.assertProjectBelongsToCompany(companyId, dto.projectId);
    if (dto.assigneeId) {
      await this.assertAssigneeBelongsToCompany(companyId, dto.assigneeId);
    }

    return this.prisma.projectTask.create({
      data: {
        companyId,
        projectId: dto.projectId,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        estimatedMinutes: dto.estimatedMinutes,
        assigneeId: dto.assigneeId,
      },
      include: taskInclude,
    });
  }

  async update(companyId: string, id: string, dto: UpdateTaskDto) {
    await this.findOne(companyId, id);
    if (dto.projectId) {
      await this.assertProjectBelongsToCompany(companyId, dto.projectId);
    }
    if (dto.assigneeId) {
      await this.assertAssigneeBelongsToCompany(companyId, dto.assigneeId);
    }

    return this.prisma.projectTask.update({
      where: { id },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: taskInclude,
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.findOne(companyId, id);
    const timeEntryCount = await this.prisma.timeEntry.count({ where: { taskId: id } });
    if (timeEntryCount > 0) {
      throw new ForbiddenException("Cannot delete a task that has logged time entries");
    }
    await this.prisma.projectTask.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListTasksQueryDto, "search" | "status" | "priority" | "projectId" | "assigneeId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.projectTask.findMany({
      where,
      include: taskInclude,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      project: r.project.code,
      title: r.title,
      status: r.status,
      priority: r.priority,
      assignee: r.assignee ? `${r.assignee.firstName} ${r.assignee.lastName}` : "",
      dueDate: r.dueDate ?? "",
    }));
    return toCsv(flat, ["project", "title", "status", "priority", "assignee", "dueDate"]);
  }
}
