import type { TicketItemType } from "./ticket.type";

interface PrismaTicketWithRelations {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string | null;
  status: string;
  priority: string;
  requesterEmail: string | null;
  dueDate: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  account: { id: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  assignee: { id: string; firstName: string; lastName: string } | null;
}

export function toTicketItemType(ticket: PrismaTicketWithRelations): TicketItemType {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    description: ticket.description ?? undefined,
    status: ticket.status,
    priority: ticket.priority,
    requesterEmail: ticket.requesterEmail ?? undefined,
    dueDate: ticket.dueDate ?? undefined,
    resolvedAt: ticket.resolvedAt ?? undefined,
    closedAt: ticket.closedAt ?? undefined,
    account: ticket.account ?? undefined,
    contact: ticket.contact ?? undefined,
    assignee: ticket.assignee ?? undefined,
    createdAt: ticket.createdAt,
  };
}
