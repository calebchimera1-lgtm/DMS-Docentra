import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CreateTimeEntryDto } from "./dto/create-time-entry.dto";
import type { ListTimeEntriesQueryDto } from "./dto/list-time-entries-query.dto";
import type { UpdateTimeEntryDto } from "./dto/update-time-entry.dto";

const EXPORT_ROW_LIMIT = 5000;

const timeEntryInclude = {
  task: { select: { id: true, title: true, project: { select: { id: true, name: true, code: true } } } },
  user: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class TimeEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(
    companyId: string,
    query: Pick<ListTimeEntriesQueryDto, "taskId" | "projectId" | "userId" | "billable">,
  ) {
    return {
      companyId,
      ...(query.taskId ? { taskId: query.taskId } : {}),
      ...(query.projectId ? { task: { projectId: query.projectId } } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.billable !== undefined ? { billable: query.billable } : {}),
    };
  }

  private async assertTaskBelongsToCompany(companyId: string, taskId: string) {
    const task = await this.prisma.projectTask.findFirst({ where: { id: taskId, companyId, deletedAt: null } });
    if (!task) {
      throw new BadRequestException("Task does not belong to this company");
    }
  }

  async list(companyId: string, query: ListTimeEntriesQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where,
        include: timeEntryInclude,
        orderBy: { entryDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.timeEntry.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id, companyId },
      include: timeEntryInclude,
    });
    if (!entry) {
      throw new NotFoundException("Time entry not found");
    }
    return entry;
  }

  async create(companyId: string, userId: string, dto: CreateTimeEntryDto) {
    await this.assertTaskBelongsToCompany(companyId, dto.taskId);

    return this.prisma.timeEntry.create({
      data: {
        companyId,
        taskId: dto.taskId,
        userId,
        minutes: dto.minutes,
        entryDate: new Date(dto.entryDate),
        note: dto.note,
        billable: dto.billable,
      },
      include: timeEntryInclude,
    });
  }

  async update(companyId: string, userId: string, id: string, dto: UpdateTimeEntryDto) {
    const entry = await this.findOne(companyId, id);
    if (entry.user.id !== userId) {
      throw new ForbiddenException("You can only edit your own time entries");
    }

    return this.prisma.timeEntry.update({
      where: { id },
      data: {
        ...dto,
        entryDate: dto.entryDate ? new Date(dto.entryDate) : undefined,
      },
      include: timeEntryInclude,
    });
  }

  async remove(companyId: string, userId: string, id: string): Promise<void> {
    const entry = await this.findOne(companyId, id);
    if (entry.user.id !== userId) {
      throw new ForbiddenException("You can only delete your own time entries");
    }
    await this.prisma.timeEntry.delete({ where: { id } });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListTimeEntriesQueryDto, "taskId" | "projectId" | "userId" | "billable">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.timeEntry.findMany({
      where,
      include: timeEntryInclude,
      orderBy: { entryDate: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      project: r.task.project.code,
      task: r.task.title,
      user: `${r.user.firstName} ${r.user.lastName}`,
      minutes: r.minutes,
      entryDate: r.entryDate,
      billable: r.billable,
    }));
    return toCsv(flat, ["project", "task", "user", "minutes", "entryDate", "billable"]);
  }
}
