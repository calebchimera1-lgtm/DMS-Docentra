"use client";

import { useEffect, useState } from "react";
import { Banknote, FileText, TrendingUp, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { apiClient } from "../../../lib/api-client";
import { formatCents } from "../../../lib/format";
import type { AccountingSummary, BalancesByType } from "../../../lib/types";
import { AccountingSubnav } from "../../../components/accounting/accounting-subnav";
import { StageBarChart } from "../../../components/crm/stage-bar-chart";
import { StatTile } from "../../../components/stat-tile";

const TYPE_LABELS: Record<string, string> = {
  ASSET: "Assets",
  LIABILITY: "Liabilities",
  EQUITY: "Equity",
  REVENUE: "Revenue",
  EXPENSE: "Expenses",
};

export default function AccountingOverviewPage() {
  const [summary, setSummary] = useState<AccountingSummary | null>(null);
  const [byType, setByType] = useState<BalancesByType | null>(null);

  useEffect(() => {
    void apiClient.get<AccountingSummary>("/accounting/reports/summary").then(setSummary);
    void apiClient.get<BalancesByType>("/accounting/reports/balances-by-type").then(setByType);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Accounting</h1>
        <p className="text-sm text-muted-foreground">Chart of accounts, journal entries, and payments.</p>
      </div>

      <AccountingSubnav />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total assets" value={summary ? formatCents(summary.totalAssetsCents) : "—"} icon={Wallet} />
        <StatTile
          label="Total revenue"
          value={summary ? formatCents(summary.totalRevenueCents) : "—"}
          icon={TrendingUp}
        />
        <StatTile
          label="Net income"
          value={summary ? formatCents(summary.netIncomeCents) : "—"}
          icon={Banknote}
        />
        <StatTile label="Draft entries" value={summary?.draftEntryCount ?? "—"} icon={FileText} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Balances by account type</CardTitle>
        </CardHeader>
        <CardContent>
          {byType ? (
            <StageBarChart
              ariaLabel="Net balance by ledger account type"
              data={byType.types.map((t) => ({
                label: TYPE_LABELS[t.type] ?? t.type,
                value: Math.abs(t.balanceCents),
                displayValue: formatCents(t.balanceCents),
              }))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
