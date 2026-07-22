import type { CrmLeadType } from "./lead.type";

interface PrismaLeadRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  source: string | null;
  status: string;
}

export function toCrmLeadType(lead: PrismaLeadRow): CrmLeadType {
  return {
    id: lead.id,
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email ?? undefined,
    phone: lead.phone ?? undefined,
    companyName: lead.companyName ?? undefined,
    source: lead.source ?? undefined,
    status: lead.status,
  };
}
