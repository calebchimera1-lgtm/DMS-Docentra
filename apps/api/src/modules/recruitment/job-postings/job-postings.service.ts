import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CreateJobPostingDto } from "./dto/create-job-posting.dto";
import type { ListJobPostingsQueryDto } from "./dto/list-job-postings-query.dto";
import type { UpdateJobPostingDto } from "./dto/update-job-posting.dto";

const EXPORT_ROW_LIMIT = 5000;

const postingInclude = {
  department: { select: { id: true, name: true, code: true } },
  _count: { select: { applications: true } },
} as const;

@Injectable()
export class JobPostingsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(
    companyId: string,
    query: Pick<ListJobPostingsQueryDto, "search" | "status" | "departmentId">,
  ) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search ? { title: { contains: query.search, mode: "insensitive" as const } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    };
  }

  async list(companyId: string, query: ListJobPostingsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.jobPosting.findMany({
        where,
        include: postingInclude,
        orderBy: { postedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.jobPosting.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const posting = await this.prisma.jobPosting.findFirst({
      where: { id, companyId, deletedAt: null },
      include: postingInclude,
    });
    if (!posting) {
      throw new NotFoundException("Job posting not found");
    }
    return posting;
  }

  async create(companyId: string, dto: CreateJobPostingDto) {
    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, companyId, deletedAt: null },
      });
      if (!department) {
        throw new BadRequestException("Department does not belong to this company");
      }
    }
    return this.prisma.jobPosting.create({ data: { companyId, ...dto }, include: postingInclude });
  }

  async update(companyId: string, id: string, dto: UpdateJobPostingDto) {
    await this.findOne(companyId, id);
    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, companyId, deletedAt: null },
      });
      if (!department) {
        throw new BadRequestException("Department does not belong to this company");
      }
    }
    return this.prisma.jobPosting.update({ where: { id }, data: dto, include: postingInclude });
  }

  async close(companyId: string, id: string) {
    const posting = await this.findOne(companyId, id);
    if (posting.status === "CLOSED") {
      throw new BadRequestException("This job posting is already closed");
    }
    return this.prisma.jobPosting.update({
      where: { id },
      data: { status: "CLOSED", closedAt: new Date() },
      include: postingInclude,
    });
  }

  async reopen(companyId: string, id: string) {
    const posting = await this.findOne(companyId, id);
    if (posting.status !== "CLOSED") {
      throw new BadRequestException("Only a closed job posting can be reopened");
    }
    return this.prisma.jobPosting.update({
      where: { id },
      data: { status: "OPEN", closedAt: null },
      include: postingInclude,
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.findOne(companyId, id);
    await this.prisma.jobPosting.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListJobPostingsQueryDto, "search" | "status" | "departmentId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.jobPosting.findMany({
      where,
      include: postingInclude,
      orderBy: { postedAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      title: r.title,
      department: r.department?.name ?? "",
      employmentType: r.employmentType,
      openings: r.openings,
      applicationCount: r._count.applications,
      status: r.status,
    }));
    return toCsv(flat, ["title", "department", "employmentType", "openings", "applicationCount", "status"]);
  }
}
