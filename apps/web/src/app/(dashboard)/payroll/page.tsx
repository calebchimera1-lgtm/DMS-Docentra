"use client";

import { useEffect, useState } from "react";
import { Banknote, FileClock, UserCheck, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { apiClient } from "../../../lib/api-client";
import { formatCents } from "../../../lib/format";
import type { PayrollSummary, PayslipsByStatus } from "../../../lib/types";
import { PayrollSubnav } from "../../../components/payroll/payroll-subnav";
import { StageBarChart } from "../../../components/crm/stage-bar-chart";
import { StatTile } from "../../../components/stat-tile";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PAID: "Paid",
};

export default function PayrollOverviewPage() {
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [byStatus, setByStatus] = useState<PayslipsByStatus[] | null>(null);

  useEffect(() => {
    void apiClient.get<PayrollSummary>("/payroll/reports/summary").then(setSummary);
    void apiClient.get<PayslipsByStatus[]>("/payroll/reports/payslips-by-status").then(setByStatus);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Payroll</h1>
        <p className="text-sm text-muted-foreground">Salary components, pay runs, and payslips.</p>
      </div>

      <PayrollSubnav />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Eligible employees" value={summary?.eligibleEmployeeCount ?? "—"} icon={UserCheck} />
        <StatTile label="Draft pay runs" value={summary?.draftPayRunCount ?? "—"} icon={FileClock} />
        <StatTile label="Processed (unpaid)" value={summary?.processedPayRunCount ?? "—"} icon={Wallet} />
        <StatTile
          label="Total net pay paid"
          value={summary ? formatCents(summary.totalNetPayPaidCents) : "—"}
          icon={Banknote}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payslips by status</CardTitle>
        </CardHeader>
        <CardContent>
          {byStatus ? (
            <StageBarChart
              ariaLabel="Payslip count by status"
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
    </div>
  );
}
