import type { LedgerAccountItemType } from "./ledger-account.type";

interface PrismaLedgerAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
}

export function toLedgerAccountItemType(account: PrismaLedgerAccount): LedgerAccountItemType {
  return {
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    isActive: account.isActive,
  };
}
