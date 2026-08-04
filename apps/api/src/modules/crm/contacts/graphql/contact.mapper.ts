import type { CrmContactType } from "./contact.type";

interface PrismaContactWithRelations {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  account: { id: string; name: string } | null;
}

export function toCrmContactType(contact: PrismaContactWithRelations): CrmContactType {
  return {
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email ?? undefined,
    phone: contact.phone ?? undefined,
    title: contact.title ?? undefined,
    account: contact.account ?? undefined,
  };
}
