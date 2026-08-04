"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Boxes, FileText, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { apiClient } from "../../../lib/api-client";
import { formatCents } from "../../../lib/format";
import type { InvoicesByStatus, SalesSummary } from "../../../lib/types";
import { SalesSubnav } from "../../../components/sales/sales-subnav";
import { StageBarChart } from "../../../components/crm/stage-bar-chart";
import { StatTile } from "../../../components/stat-tile";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

export default function SalesOverviewPage() {
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [byStatus, setByStatus] = useState<InvoicesByStatus | null>(null);

  useEffect(() => {
    void apiClient.get<SalesSummary>("/sales/reports/summary").then(setSummary);
    void apiClient.get<InvoicesByStatus>("/sales/reports/invoices-by-status").then(setByStatus);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Sales</h1>
        <p className="text-sm text-muted-foreground">Products, quotes, sales orders, and invoices.</p>
      </div>

      <SalesSubnav />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active products" value={summary?.productCount ?? "—"} icon={Boxes} />
        <StatTile label="Open quotes" value={summary?.openQuoteCount ?? "—"} icon={FileText} />
        <StatTile
          label="Revenue booked"
          value={summary ? formatCents(summary.revenueBookedCents) : "—"}
          icon={Wallet}
        />
        <StatTile label="Overdue invoices" value={summary?.overdueInvoiceCount ?? "—"} icon={AlertTriangle} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Invoices by status</CardTitle>
          </CardHeader>
          <CardContent>
            {byStatus ? (
              <StageBarChart
                ariaLabel="Invoice value by status"
                data={byStatus.statuses.map((s) => ({
                  label: STATUS_LABELS[s.status] ?? s.status,
                  value: s.totalCents,
                  displayValue: formatCents(s.totalCents),
                }))}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue collected</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-3xl font-semibold text-foreground">
              {summary ? formatCents(summary.revenueCollectedCents) : "—"}
            </p>
            <p className="text-sm text-muted-foreground">
              Booked to date: {summary ? formatCents(summary.revenueBookedCents) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
