import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PaginatedResult } from "@omniflow/shared";
import { PrismaService } from "../../../prisma/prisma.service";
import { toCsv } from "../../../common/utils/csv.util";
import { formatDocumentNumber } from "../../sales/common/document-number.util";
import type { CreateTicketDto } from "./dto/create-ticket.dto";
import type { ListTicketsQueryDto } from "./dto/list-tickets-query.dto";
import type { UpdateTicketDto } from "./dto/update-ticket.dto";

const EXPORT_ROW_LIMIT = 5000;

const ticketInclude = {
  account: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  assignee: { select: { id: true, firstName: true, lastName: true } },
} as const;

const OPEN_STATUSES = new Set(["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER"]);

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(
    companyId: string,
    query: Pick<ListTicketsQueryDto, "search" | "status" | "priority" | "assigneeId" | "accountId">,
  ) {
    return {
      companyId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { subject: { contains: query.search, mode: "insensitive" as const } },
              { ticketNumber: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
    };
  }

  private async assertAccountBelongsToCompany(companyId: string, accountId: string): Promise<void> {
    const account = await this.prisma.crmAccount.findFirst({ where: { id: accountId, companyId, deletedAt: null } });
    if (!account) {
      throw new BadRequestException("Account does not belong to this company");
    }
  }

  private async assertContactBelongsToCompany(companyId: string, contactId: string): Promise<void> {
    const contact = await this.prisma.crmContact.findFirst({ where: { id: contactId, companyId, deletedAt: null } });
    if (!contact) {
      throw new BadRequestException("Contact does not belong to this company");
    }
  }

  private async assertAssigneeBelongsToCompany(companyId: string, assigneeId: string): Promise<void> {
    const assignee = await this.prisma.user.findFirst({ where: { id: assigneeId, companyId, deletedAt: null } });
    if (!assignee) {
      throw new BadRequestException("Assignee does not belong to this company");
    }
  }

  async list(companyId: string, query: ListTicketsQueryDto): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(companyId, query);

    const [items, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: ticketInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(companyId: string, id: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, companyId, deletedAt: null },
      include: ticketInclude,
    });
    if (!ticket) {
      throw new NotFoundException("Ticket not found");
    }
    return ticket;
  }

  async create(companyId: string, dto: CreateTicketDto) {
    if (dto.accountId) {
      await this.assertAccountBelongsToCompany(companyId, dto.accountId);
    }
    if (dto.contactId) {
      await this.assertContactBelongsToCompany(companyId, dto.contactId);
    }
    if (dto.assigneeId) {
      await this.assertAssigneeBelongsToCompany(companyId, dto.assigneeId);
    }

    const count = await this.prisma.ticket.count({ where: { companyId } });
    return this.prisma.ticket.create({
      data: {
        companyId,
        ticketNumber: formatDocumentNumber("TKT", count),
        subject: dto.subject,
        description: dto.description,
        priority: dto.priority,
        accountId: dto.accountId,
        contactId: dto.contactId,
        requesterEmail: dto.requesterEmail,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        assigneeId: dto.assigneeId,
        status: dto.assigneeId ? "IN_PROGRESS" : undefined,
      },
      include: ticketInclude,
    });
  }

  async update(companyId: string, id: string, dto: UpdateTicketDto) {
    await this.findOne(companyId, id);
    if (dto.accountId) {
      await this.assertAccountBelongsToCompany(companyId, dto.accountId);
    }
    if (dto.contactId) {
      await this.assertContactBelongsToCompany(companyId, dto.contactId);
    }

    return this.prisma.ticket.update({
      where: { id },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: ticketInclude,
    });
  }

  async assign(companyId: string, id: string, assigneeId: string) {
    const ticket = await this.findOne(companyId, id);
    await this.assertAssigneeBelongsToCompany(companyId, assigneeId);

    return this.prisma.ticket.update({
      where: { id },
      data: {
        assigneeId,
        status: ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status,
      },
      include: ticketInclude,
    });
  }

  async resolve(companyId: string, id: string) {
    const ticket = await this.findOne(companyId, id);
    if (!OPEN_STATUSES.has(ticket.status)) {
      throw new BadRequestException("Only an open ticket can be resolved");
    }
    return this.prisma.ticket.update({
      where: { id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
      include: ticketInclude,
    });
  }

  async close(companyId: string, id: string) {
    const ticket = await this.findOne(companyId, id);
    if (ticket.status === "CLOSED") {
      throw new BadRequestException("Ticket is already closed");
    }
    return this.prisma.ticket.update({
      where: { id },
      data: { status: "CLOSED", closedAt: new Date() },
      include: ticketInclude,
    });
  }

  async reopen(companyId: string, id: string) {
    const ticket = await this.findOne(companyId, id);
    if (ticket.status !== "RESOLVED" && ticket.status !== "CLOSED") {
      throw new BadRequestException("Only a resolved or closed ticket can be reopened");
    }
    return this.prisma.ticket.update({
      where: { id },
      data: { status: "OPEN", resolvedAt: null, closedAt: null },
      include: ticketInclude,
    });
  }

  async remove(companyId: string, id: string): Promise<void> {
    await this.findOne(companyId, id);
    await this.prisma.ticket.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async exportCsv(
    companyId: string,
    query: Pick<ListTicketsQueryDto, "search" | "status" | "priority" | "assigneeId" | "accountId">,
  ): Promise<string> {
    const where = this.buildWhere(companyId, query);
    const rows = await this.prisma.ticket.findMany({
      where,
      include: ticketInclude,
      orderBy: { createdAt: "desc" },
      take: EXPORT_ROW_LIMIT,
    });
    const flat = rows.map((r) => ({
      ticketNumber: r.ticketNumber,
      subject: r.subject,
      status: r.status,
      priority: r.priority,
      account: r.account?.name ?? "",
      assignee: r.assignee ? `${r.assignee.firstName} ${r.assignee.lastName}` : "",
      dueDate: r.dueDate ?? "",
    }));
    return toCsv(flat, ["ticketNumber", "subject", "status", "priority", "account", "assignee", "dueDate"]);
  }
}
