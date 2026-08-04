import type { JournalEntryType, JournalLineItemType } from "./journal-entry.type";

interface PrismaJournalLineWithAccount {
  id: string;
  debitCents: number;
  creditCents: number;
  description: string | null;
  ledgerAccountId: string;
  ledgerAccount: { id: string; code: string; name: string };
}

interface PrismaJournalEntryWithLines {
  id: string;
  entryNumber: string;
  status: string;
  entryDate: Date;
  memo: string | null;
  lines: PrismaJournalLineWithAccount[];
}

function toJournalLineItemType(line: PrismaJournalLineWithAccount): JournalLineItemType {
  return {
    id: line.id,
    debitCents: line.debitCents,
    creditCents: line.creditCents,
    description: line.description ?? undefined,
    ledgerAccountId: line.ledgerAccountId,
    ledgerAccountCode: line.ledgerAccount.code,
    ledgerAccountName: line.ledgerAccount.name,
  };
}

export function toJournalEntryType(entry: PrismaJournalEntryWithLines): JournalEntryType {
  return {
    id: entry.id,
    entryNumber: entry.entryNumber,
    status: entry.status,
    entryDate: entry.entryDate,
    memo: entry.memo ?? undefined,
    lines: entry.lines.map(toJournalLineItemType),
  };
}
