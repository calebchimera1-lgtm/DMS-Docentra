import type { TimeEntryItemType } from "./time-entry.type";

interface PrismaTimeEntryWithRelations {
  id: string;
  minutes: number;
  entryDate: Date;
  note: string | null;
  billable: boolean;
  task: { id: string; title: string; project: { id: string; name: string; code: string } };
  user: { id: string; firstName: string; lastName: string };
}

export function toTimeEntryItemType(entry: PrismaTimeEntryWithRelations): TimeEntryItemType {
  return {
    id: entry.id,
    minutes: entry.minutes,
    entryDate: entry.entryDate,
    note: entry.note ?? undefined,
    billable: entry.billable,
    task: { id: entry.task.id, title: entry.task.title },
    user: entry.user,
  };
}
