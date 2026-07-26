"use client";

import { useEffect, useState } from "react";
import { Banknote, CheckCircle2, FileClock, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { apiClient } from "../../../lib/api-client";
import { formatCents } from "../../../lib/format";
import type { ExpenseClaimsByStatus, ExpensesByCategory, ExpensesSummary } from "../../../lib/types";
import { ExpensesSubnav } from "../../../components/expenses/expenses-subnav";
import { StageBarChart } from "../../../components/crm/stage-bar-chart";
import { StatTile } from "../../../components/stat-tile";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

export default function ExpensesOverviewPage() {
  const [summary, setSummary] = useState<ExpensesSummary | null>(null);
  const [byStatus, setByStatus] = useState<ExpenseClaimsByStatus[] | null>(null);
  const [byCategory, setByCategory] = useState<ExpensesByCategory[] | null>(null);

  useEffect(() => {
    void apiClient.get<ExpensesSummary>("/expenses/reports/summary").then(setSummary);
    void apiClient.get<ExpenseClaimsByStatus[]>("/expenses/reports/claims-by-status").then(setByStatus);
    void apiClient.get<ExpensesByCategory[]>("/expenses/reports/spend-by-category").then(setByCategory);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Expenses</h1>
        <p className="text-sm text-muted-foreground">Expense categories and employee expense claims.</p>
      </div>

      <ExpensesSubnav />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Draft claims" value={summary?.draftClaimCount ?? "—"} icon={FileClock} />
        <StatTile label="Awaiting approval" value={summary?.submittedClaimCount ?? "—"} icon={Send} />
        <StatTile label="Approved (unpaid)" value={summary?.approvedUnpaidClaimCount ?? "—"} icon={CheckCircle2} />
        <StatTile
          label="Total paid"
          value={summary ? formatCents(summary.totalPaidCents) : "—"}
          icon={Banknote}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Claims by status</CardTitle>
          </CardHeader>
          <CardContent>
            {byStatus ? (
              <StageBarChart
                ariaLabel="Expense claim count by status"
                data={byStatus.map((s) => ({
                  label: STATUS_LABELS[s.status] ?? s.status,
                  value: s.count,
                  displayValue: String(s.count),
                }))}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spend by category</CardTitle>
          </CardHeader>
          <CardContent>
            {byCategory ? (
              byCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No approved spend yet.</p>
              ) : (
                <StageBarChart
                  ariaLabel="Approved spend by category"
                  data={byCategory.map((c) => ({
                    label: c.categoryName,
                    value: c.totalCents,
                    displayValue: formatCents(c.totalCents),
                  }))}
                />
              )
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
