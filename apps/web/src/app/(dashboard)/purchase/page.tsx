"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, PackageCheck, ShoppingBag, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { apiClient } from "../../../lib/api-client";
import { formatCents } from "../../../lib/format";
import type { PurchaseOrdersByStatus, PurchaseSummary } from "../../../lib/types";
import { PurchaseSubnav } from "../../../components/purchase/purchase-subnav";
import { StageBarChart } from "../../../components/crm/stage-bar-chart";
import { StatTile } from "../../../components/stat-tile";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  CONFIRMED: "Confirmed",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

export default function PurchaseOverviewPage() {
  const [summary, setSummary] = useState<PurchaseSummary | null>(null);
  const [byStatus, setByStatus] = useState<PurchaseOrdersByStatus[] | null>(null);

  useEffect(() => {
    void apiClient.get<PurchaseSummary>("/purchase/reports/summary").then(setSummary);
    void apiClient.get<PurchaseOrdersByStatus[]>("/purchase/reports/orders-by-status").then(setByStatus);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Purchase</h1>
        <p className="text-sm text-muted-foreground">Suppliers, purchase orders, and goods receipts.</p>
      </div>

      <PurchaseSubnav />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Suppliers" value={summary?.supplierCount ?? "—"} icon={Truck} />
        <StatTile label="Open orders" value={summary?.openOrderCount ?? "—"} icon={ShoppingBag} />
        <StatTile
          label="Committed spend"
          value={summary ? formatCents(summary.committedSpendCents) : "—"}
          icon={PackageCheck}
        />
        <StatTile label="Received orders" value={summary?.receivedOrderCount ?? "—"} icon={CheckCircle2} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Purchase orders by status</CardTitle>
        </CardHeader>
        <CardContent>
          {byStatus ? (
            <StageBarChart
              ariaLabel="Purchase order count by status"
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
