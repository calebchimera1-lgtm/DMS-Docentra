import { Injectable } from "@nestjs/common";
import type { TicketStatus } from "@omniflow/database";
import { PrismaService } from "../../../prisma/prisma.service";

const TICKET_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"];
const OPEN_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER"];

@Injectable()
export class SupportReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(companyId: string) {
    const [openTicketCount, unassignedTicketCount, overdueTicketCount, totalTicketCount] = await Promise.all([
      this.prisma.ticket.count({ where: { companyId, deletedAt: null, status: { in: OPEN_STATUSES } } }),
      this.prisma.ticket.count({
        where: { companyId, deletedAt: null, assigneeId: null, status: { in: OPEN_STATUSES } },
      }),
      this.prisma.ticket.count({
        where: { companyId, deletedAt: null, status: { in: OPEN_STATUSES }, dueDate: { lt: new Date() } },
      }),
      this.prisma.ticket.count({ where: { companyId, deletedAt: null } }),
    ]);

    return { openTicketCount, unassignedTicketCount, overdueTicketCount, totalTicketCount };
  }

  async ticketsByStatus(companyId: string) {
    const grouped = await this.prisma.ticket.groupBy({
      by: ["status"],
      where: { companyId, deletedAt: null },
      _count: { _all: true },
    });
    const countByStatus = new Map(grouped.map((g) => [g.status, g._count._all]));
    return TICKET_STATUSES.map((status) => ({ status, count: countByStatus.get(status) ?? 0 }));
  }
}
