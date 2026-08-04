import { Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CreateCandidateDto } from "./dto/create-candidate.dto";
import type { ListCandidatesQueryDto } from "./dto/list-candidates-query.dto";
import type { UpdateCandidateDto } from "./dto/update-candidate.dto";

const EXPORT_ROW_LIMIT = 5000;

@Injectable()
export class CandidatesService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListCandidatesQueryDto, "search">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" as const } },
              { lastName: { contains: query.search, mode: "insensitive" as const } },
              { email: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
  }

  async list(companyId: string, query: ListCandidatesQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.candidate.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.candidate.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const candidate = await this.prisma.candidate.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!candidate) {
      throw new NotFoundException("Candidate not found");
    }
    return candidate;
  }

  async create(companyId: string, dto: CreateCandidateDto) {
    return this.prisma.candidate.create({ data: { companyId, ...dto } });
  }

  async update(companyId: string, id: string, dto: UpdateCandidateDto) {
    await this.findOne(companyId, id);
    return this.prisma.candidate.update({ where: { id }, data: dto });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.findOne(companyId, id);
    await this.prisma.candidate.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(companyId: string, query: Pick<ListCandidatesQueryDto, "search">): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.candidate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, source: true },
    });
    return toCsv(rows, ["id", "firstName", "lastName", "email", "phone", "source"]);
  }
}
