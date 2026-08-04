import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import type { ApplicationStatus } from "@omniflow/database";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import { formatDocumentNumber } from "../../sales/common/document-number.util";
import type { CreateApplicationDto } from "./dto/create-application.dto";
import type { HireApplicationDto } from "./dto/hire-application.dto";
import type { ListApplicationsQueryDto } from "./dto/list-applications-query.dto";
import type { RejectApplicationDto } from "./dto/reject-application.dto";
import type { UpdateApplicationDto } from "./dto/update-application.dto";

const EXPORT_ROW_LIMIT = 5000;
const NON_TERMINAL_STATUSES: ApplicationStatus[] = ["APPLIED", "SCREENING", "INTERVIEWING", "OFFERED"];

const applicationInclude = {
  jobPosting: { select: { id: true, title: true, status: true } },
  candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
  hiredEmployee: { select: { id: true, employeeNumber: true } },
} as const;

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(
    companyId: string,
    query: Pick<ListApplicationsQueryDto, "status" | "jobPostingId" | "candidateId">,
  ) {
    return {
      companyId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.jobPostingId ? { jobPostingId: query.jobPostingId } : {}),
      ...(query.candidateId ? { candidateId: query.candidateId } : {}),
    };
  }

  private assertNonTerminal(status: ApplicationStatus, action: string) {
    if (!NON_TERMINAL_STATUSES.includes(status)) {
      throw new BadRequestException(`Cannot ${action} an application that is already ${status.toLowerCase()}`);
    }
  }

  async list(companyId: string, query: ListApplicationsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: applicationInclude,
        orderBy: { appliedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.application.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const application = await this.prisma.application.findFirst({
      where: { id, companyId, deletedAt: null },
      include: applicationInclude,
    });
    if (!application) {
      throw new NotFoundException("Application not found");
    }
    return application;
  }

  async create(companyId: string, dto: CreateApplicationDto) {
    const [jobPosting, candidate] = await Promise.all([
      this.prisma.jobPosting.findFirst({ where: { id: dto.jobPostingId, companyId, deletedAt: null } }),
      this.prisma.candidate.findFirst({ where: { id: dto.candidateId, companyId, deletedAt: null } }),
    ]);
    if (!jobPosting) {
      throw new BadRequestException("Job posting does not belong to this company");
    }
    if (!candidate) {
      throw new BadRequestException("Candidate does not belong to this company");
    }

    const existing = await this.prisma.application.findFirst({
      where: { jobPostingId: dto.jobPostingId, candidateId: dto.candidateId, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException("This candidate has already applied to this job posting");
    }

    return this.prisma.application.create({
      data: { companyId, jobPostingId: dto.jobPostingId, candidateId: dto.candidateId, notes: dto.notes },
      include: applicationInclude,
    });
  }

  async update(companyId: string, id: string, dto: UpdateApplicationDto) {
    await this.findOne(companyId, id);
    return this.prisma.application.update({ where: { id }, data: dto, include: applicationInclude });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.findOne(companyId, id);
    await this.prisma.application.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async screen(companyId: string, id: string) {
    const application = await this.findOne(companyId, id);
    if (application.status !== "APPLIED") {
      throw new BadRequestException("Only an application in APPLIED can move to screening");
    }
    return this.prisma.application.update({
      where: { id },
      data: { status: "SCREENING", reviewedAt: new Date() },
      include: applicationInclude,
    });
  }

  async moveToInterviewing(companyId: string, id: string) {
    const application = await this.findOne(companyId, id);
    if (application.status !== "SCREENING") {
      throw new BadRequestException("Only an application in SCREENING can move to interviewing");
    }
    return this.prisma.application.update({
      where: { id },
      data: { status: "INTERVIEWING" },
      include: applicationInclude,
    });
  }

  async offer(companyId: string, id: string) {
    const application = await this.findOne(companyId, id);
    if (application.status !== "INTERVIEWING") {
      throw new BadRequestException("Only an application in INTERVIEWING can be offered");
    }
    return this.prisma.application.update({ where: { id }, data: { status: "OFFERED" }, include: applicationInclude });
  }

  async reject(companyId: string, id: string, dto: RejectApplicationDto) {
    const application = await this.findOne(companyId, id);
    this.assertNonTerminal(application.status, "reject");
    return this.prisma.application.update({
      where: { id },
      data: { status: "REJECTED", rejectionReason: dto.rejectionReason, reviewedAt: new Date() },
      include: applicationInclude,
    });
  }

  async withdraw(companyId: string, id: string) {
    const application = await this.findOne(companyId, id);
    this.assertNonTerminal(application.status, "withdraw");
    return this.prisma.application.update({
      where: { id },
      data: { status: "WITHDRAWN" },
      include: applicationInclude,
    });
  }

  /**
   * Converts an OFFERED application into an HR Employee — a real side
   * effect, so it's a dedicated action rather than a plain status update,
   * the same precedent as Purchase's receive() and Payroll's generate().
   * Written via a direct tx.employee.create call rather than injecting
   * HrModule's service, the same cross-module tx.* convention Purchase
   * uses for Inventory.
   */
  async hire(companyId: string, id: string, dto: HireApplicationDto) {
    const application = await this.findOne(companyId, id);
    if (application.status !== "OFFERED") {
      throw new BadRequestException("Only an application in OFFERED can be hired");
    }
    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, companyId, deletedAt: null },
      });
      if (!department) {
        throw new BadRequestException("Department does not belong to this company");
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const candidate = await tx.candidate.findUniqueOrThrow({ where: { id: application.candidateId } });
      const jobPosting = await tx.jobPosting.findUniqueOrThrow({ where: { id: application.jobPostingId } });

      const employeeCount = await tx.employee.count({ where: { companyId } });
      const employee = await tx.employee.create({
        data: {
          companyId,
          employeeNumber: formatDocumentNumber("EMP", employeeCount),
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          email: candidate.email,
          phone: candidate.phone,
          jobTitle: dto.jobTitle ?? jobPosting.title,
          employmentType: dto.employmentType ?? jobPosting.employmentType,
          hireDate: new Date(dto.hireDate),
          salaryCents: dto.salaryCents,
          currency: dto.currency ?? "USD",
          departmentId: dto.departmentId ?? jobPosting.departmentId,
        },
      });

      return tx.application.update({
        where: { id: application.id },
        data: { status: "HIRED", hiredEmployeeId: employee.id, reviewedAt: new Date() },
        include: applicationInclude,
      });
    });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListApplicationsQueryDto, "status" | "jobPostingId" | "candidateId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.application.findMany({
      where,
      include: applicationInclude,
      orderBy: { appliedAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      jobPostingTitle: r.jobPosting.title,
      candidateName: `${r.candidate.firstName} ${r.candidate.lastName}`,
      candidateEmail: r.candidate.email,
      status: r.status,
      appliedAt: r.appliedAt,
    }));
    return toCsv(flat, ["jobPostingTitle", "candidateName", "candidateEmail", "status", "appliedAt"]);
  }
}
