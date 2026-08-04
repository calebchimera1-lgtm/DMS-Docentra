import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import type { CreateLeadDto } from "./dto/create-lead.dto";
import type { ListLeadsQueryDto } from "./dto/list-leads-query.dto";
import type { UpdateLeadDto } from "./dto/update-lead.dto";

const EXPORT_ROW_LIMIT = 5000;

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(companyId: string, query: Pick<ListLeadsQueryDto, "search" | "status" | "ownerId">) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" as const } },
              { lastName: { contains: query.search, mode: "insensitive" as const } },
              { email: { contains: query.search, mode: "insensitive" as const } },
              { companyName: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
    };
  }

  async list(companyId: string, query: ListLeadsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.crmLead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { owner: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.crmLead.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const lead = await this.prisma.crmLead.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { owner: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!lead) {
      throw new NotFoundException("Lead not found");
    }
    return lead;
  }

  create(companyId: string, dto: CreateLeadDto) {
    return this.prisma.crmLead.create({ data: { companyId, ...dto } });
  }

  async update(companyId: string, id: string, dto: UpdateLeadDto) {
    await this.findOne(companyId, id);
    return this.prisma.crmLead.update({ where: { id }, data: dto });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.findOne(companyId, id);
    await this.prisma.crmLead.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async convert(companyId: string, id: string) {
    const lead = await this.findOne(companyId, id);
    if (lead.status === "CONVERTED") {
      throw new BadRequestException("Lead has already been converted");
    }

    return this.prisma.$transaction(async (tx) => {
      const account = lead.companyName
        ? await tx.crmAccount.create({
            data: { companyId, name: lead.companyName, ownerId: lead.ownerId },
          })
        : null;

      const contact = await tx.crmContact.create({
        data: {
          companyId,
          accountId: account?.id,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          ownerId: lead.ownerId,
        },
      });

      const updatedLead = await tx.crmLead.update({
        where: { id },
        data: { status: "CONVERTED" },
      });

      return { lead: updatedLead, account, contact };
    });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListLeadsQueryDto, "search" | "status" | "ownerId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.crmLead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        companyName: true,
        source: true,
        status: true,
        createdAt: true,
      },
    });
    return toCsv(rows, [
      "id",
      "firstName",
      "lastName",
      "email",
      "phone",
      "companyName",
      "source",
      "status",
      "createdAt",
    ]);
  }
}
