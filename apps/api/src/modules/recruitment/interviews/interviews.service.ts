import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CompleteInterviewDto } from "./dto/complete-interview.dto";
import type { CreateInterviewDto } from "./dto/create-interview.dto";
import type { ListInterviewsQueryDto } from "./dto/list-interviews-query.dto";
import type { UpdateInterviewDto } from "./dto/update-interview.dto";

const EXPORT_ROW_LIMIT = 5000;

const interviewInclude = {
  application: {
    select: {
      id: true,
      candidate: { select: { id: true, firstName: true, lastName: true } },
      jobPosting: { select: { id: true, title: true } },
    },
  },
  interviewer: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class InterviewsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListInterviewsQueryDto, "applicationId" | "status">) {
    return {
      companyId,
      ...(query.applicationId ? { applicationId: query.applicationId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
  }

  async list(companyId: string, query: ListInterviewsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.interview.findMany({
        where,
        include: interviewInclude,
        orderBy: { scheduledAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.interview.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const interview = await this.prisma.interview.findFirst({
      where: { id, companyId },
      include: interviewInclude,
    });
    if (!interview) {
      throw new NotFoundException("Interview not found");
    }
    return interview;
  }

  async create(companyId: string, dto: CreateInterviewDto) {
    const application = await this.prisma.application.findFirst({
      where: { id: dto.applicationId, companyId, deletedAt: null },
    });
    if (!application) {
      throw new BadRequestException("Application does not belong to this company");
    }
    if (dto.interviewerId) {
      const interviewer = await this.prisma.employee.findFirst({
        where: { id: dto.interviewerId, companyId, deletedAt: null },
      });
      if (!interviewer) {
        throw new BadRequestException("Interviewer does not belong to this company");
      }
    }

    return this.prisma.interview.create({
      data: {
        companyId,
        applicationId: dto.applicationId,
        stage: dto.stage,
        scheduledAt: new Date(dto.scheduledAt),
        interviewerId: dto.interviewerId,
      },
      include: interviewInclude,
    });
  }

  async update(companyId: string, id: string, dto: UpdateInterviewDto) {
    const existing = await this.findOne(companyId, id);
    if (existing.status !== "SCHEDULED") {
      throw new BadRequestException("Only a scheduled interview can be edited");
    }
    return this.prisma.interview.update({
      where: { id },
      data: {
        stage: dto.stage,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        interviewerId: dto.interviewerId,
      },
      include: interviewInclude,
    });
  }

  async complete(companyId: string, id: string, dto: CompleteInterviewDto) {
    const existing = await this.findOne(companyId, id);
    if (existing.status !== "SCHEDULED") {
      throw new BadRequestException("Only a scheduled interview can be completed");
    }
    return this.prisma.interview.update({
      where: { id },
      data: { status: "COMPLETED", feedback: dto.feedback, rating: dto.rating },
      include: interviewInclude,
    });
  }

  async cancel(companyId: string, id: string) {
    const existing = await this.findOne(companyId, id);
    if (existing.status !== "SCHEDULED") {
      throw new BadRequestException("Only a scheduled interview can be cancelled");
    }
    return this.prisma.interview.update({ where: { id }, data: { status: "CANCELLED" }, include: interviewInclude });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListInterviewsQueryDto, "applicationId" | "status">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.interview.findMany({
      where,
      include: interviewInclude,
      orderBy: { scheduledAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      candidateName: `${r.application.candidate.firstName} ${r.application.candidate.lastName}`,
      jobPostingTitle: r.application.jobPosting.title,
      stage: r.stage,
      scheduledAt: r.scheduledAt,
      status: r.status,
      rating: r.rating ?? "",
    }));
    return toCsv(flat, ["candidateName", "jobPostingTitle", "stage", "scheduledAt", "status", "rating"]);
  }
}
