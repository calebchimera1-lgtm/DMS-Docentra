"use client";

import { useEffect, useState } from "react";
import { CircleDollarSign, Layers, Repeat, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { apiClient } from "../../../lib/api-client";
import { formatCents } from "../../../lib/format";
import type { BillingSummary, SubscriptionsByStatus } from "../../../lib/types";
import { BillingSubnav } from "../../../components/billing/billing-subnav";
import { StageBarChart } from "../../../components/crm/stage-bar-chart";
import { StatTile } from "../../../components/stat-tile";

export default function BillingOverviewPage() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [byStatus, setByStatus] = useState<SubscriptionsByStatus[] | null>(null);

  useEffect(() => {
    void apiClient.get<BillingSummary>("/billing/reports/summary").then(setSummary);
    void apiClient.get<SubscriptionsByStatus[]>("/billing/reports/by-status").then(setByStatus);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Subscription Billing</h1>
        <p className="text-sm text-muted-foreground">
          Recurring plans, subscriptions, and the invoices they generate.
        </p>
      </div>

      <BillingSubnav />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="MRR" value={summary ? formatCents(summary.mrrCents) : "—"} icon={TrendingUp} />
        <StatTile label="ARR" value={summary ? formatCents(summary.arrCents) : "—"} icon={CircleDollarSign} />
        <StatTile label="Active subscriptions" value={summary?.activeCount ?? "—"} icon={Repeat} />
        <StatTile label="Active plans" value={summary?.activePlanCount ?? "—"} icon={Layers} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recurring revenue</CardTitle>
        </CardHeader>
        <CardContent>
          {summary ? (
            <div className="flex flex-col gap-2">
              <p className="text-3xl font-semibold text-foreground">{formatCents(summary.mrrCents)}</p>
              <p className="text-sm text-muted-foreground">
                Monthly recurring revenue across {summary.activeCount} active subscription
                {summary.activeCount === 1 ? "" : "s"}. Quarterly and yearly plans are normalised onto a monthly
                footing (a yearly plan contributes a twelfth each month), and trialing, paused, and cancelled
                subscriptions are excluded because they are not billing.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {summary.invoicesRaised} invoice{summary.invoicesRaised === 1 ? "" : "s"} raised to date, totalling{" "}
                {formatCents(summary.totalBilledCents)}.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscriptions by status</CardTitle>
        </CardHeader>
        <CardContent>
          {byStatus ? (
            <StageBarChart
              ariaLabel="Subscription count by status"
              data={byStatus.map((s) => ({ label: s.status, value: s.count, displayValue: String(s.count) }))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
