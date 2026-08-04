import type { PosSessionItemType } from "./session.type";

interface PrismaSessionWithRelations {
  id: string;
  sessionNumber: string;
  status: string;
  openingFloatCents: number;
  expectedCashCents: number | null;
  countedCashCents: number | null;
  cashDifferenceCents: number | null;
  warehouse: { id: string; name: string; code: string };
}

export function toSessionItemType(session: PrismaSessionWithRelations): PosSessionItemType {
  return {
    id: session.id,
    sessionNumber: session.sessionNumber,
    status: session.status,
    openingFloatCents: session.openingFloatCents,
    expectedCashCents: session.expectedCashCents ?? undefined,
    countedCashCents: session.countedCashCents ?? undefined,
    cashDifferenceCents: session.cashDifferenceCents ?? undefined,
    warehouse: session.warehouse,
  };
}
