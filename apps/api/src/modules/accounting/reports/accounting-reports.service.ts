import { Injectable } from "@nestjs/common";
import type { LedgerAccountType } from "@omniflow/database";
import { PrismaService } from "../../../prisma/prisma.service";

const NORMAL_DEBIT_TYPES = new Set<LedgerAccountType>(["ASSET", "EXPENSE"]);
const TYPES: LedgerAccountType[] = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

@Injectable()
export class AccountingReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Balances only reflect POSTED journal entries — draft entries haven't
   * happened yet from the ledger's point of view.
   */
  private async postedLinesByType(companyId: string) {
    const lines = await this.prisma.journalLine.findMany({
      where: { journalEntry: { companyId, status: "POSTED", deletedAt: null } },
      select: { debitCents: true, creditCents: true, ledgerAccount: { select: { type: true } } },
    });

    const totals = new Map<LedgerAccountType, { debitCents: number; creditCents: number }>();
    for (const type of TYPES) totals.set(type, { debitCents: 0, creditCents: 0 });
    for (const line of lines) {
      const bucket = totals.get(line.ledgerAccount.type)!;
      bucket.debitCents += line.debitCents;
      bucket.creditCents += line.creditCents;
    }
    return totals;
  }

  private balanceFor(type: LedgerAccountType, totals: { debitCents: number; creditCents: number }): number {
    return NORMAL_DEBIT_TYPES.has(type) ? totals.debitCents - totals.creditCents : totals.creditCents - totals.debitCents;
  }

  async balancesByType(companyId: string) {
    const totals = await this.postedLinesByType(companyId);
    return {
      types: TYPES.map((type) => ({
        type,
        debitCents: totals.get(type)!.debitCents,
        creditCents: totals.get(type)!.creditCents,
        balanceCents: this.balanceFor(type, totals.get(type)!),
      })),
    };
  }

  async summary(companyId: string) {
    const [ledgerAccountCount, draftEntryCount, totals] = await Promise.all([
      this.prisma.ledgerAccount.count({ where: { companyId, deletedAt: null, isActive: true } }),
      this.prisma.journalEntry.count({ where: { companyId, deletedAt: null, status: "DRAFT" } }),
      this.postedLinesByType(companyId),
    ]);

    const totalAssetsCents = this.balanceFor("ASSET", totals.get("ASSET")!);
    const totalLiabilitiesCents = this.balanceFor("LIABILITY", totals.get("LIABILITY")!);
    const totalEquityCents = this.balanceFor("EQUITY", totals.get("EQUITY")!);
    const totalRevenueCents = this.balanceFor("REVENUE", totals.get("REVENUE")!);
    const totalExpensesCents = this.balanceFor("EXPENSE", totals.get("EXPENSE")!);

    return {
      ledgerAccountCount,
      draftEntryCount,
      totalAssetsCents,
      totalLiabilitiesCents,
      totalEquityCents,
      totalRevenueCents,
      totalExpensesCents,
      netIncomeCents: totalRevenueCents - totalExpensesCents,
    };
  }
}
