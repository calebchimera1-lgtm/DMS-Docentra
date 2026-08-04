import type { CrmAccountType } from "./account.type";

interface PrismaAccountWithRelations {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  _count?: { contacts: number; deals: number };
}

export function toCrmAccountType(account: PrismaAccountWithRelations): CrmAccountType {
  return {
    id: account.id,
    name: account.name,
    industry: account.industry ?? undefined,
    website: account.website ?? undefined,
    phone: account.phone ?? undefined,
    contactCount: account._count?.contacts,
    dealCount: account._count?.deals,
  };
}
