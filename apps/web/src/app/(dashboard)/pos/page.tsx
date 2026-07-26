"use client";

import { useEffect, useState } from "react";
import { Banknote, CircleSlash, Receipt, Undo2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { apiClient } from "../../../lib/api-client";
import { formatCents } from "../../../lib/format";
import type { PosSalesByPaymentMethod, PosSummary } from "../../../lib/types";
import { PosSubnav } from "../../../components/pos/pos-subnav";
import { StageBarChart } from "../../../components/crm/stage-bar-chart";
import { StatTile } from "../../../components/stat-tile";

export default function PosOverviewPage() {
  const [summary, setSummary] = useState<PosSummary | null>(null);
  const [byPaymentMethod, setByPaymentMethod] = useState<PosSalesByPaymentMethod[] | null>(null);

  useEffect(() => {
    void apiClient.get<PosSummary>("/pos/reports/summary").then(setSummary);
    void apiClient.get<PosSalesByPaymentMethod[]>("/pos/reports/by-payment-method").then(setByPaymentMethod);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Point of Sale</h1>
        <p className="text-sm text-muted-foreground">
          Register sessions and sales, with immediate stock deduction and cash reconciliation.
        </p>
      </div>

      <PosSubnav />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Open registers" value={summary?.openSessionCount ?? "—"} icon={Receipt} />
        <StatTile
          label="Total sales value"
          value={summary ? formatCents(summary.totalSalesValueCents) : "—"}
          icon={Banknote}
        />
        <StatTile label="Voided" value={summary?.voidedCount ?? "—"} icon={CircleSlash} />
        <StatTile label="Refunded" value={summary?.refundedCount ?? "—"} icon={Undo2} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Completed sales by payment method</CardTitle>
        </CardHeader>
        <CardContent>
          {byPaymentMethod ? (
            <StageBarChart
              ariaLabel="Completed sales value by payment method"
              data={byPaymentMethod.map((m) => ({
                label: m.paymentMethod,
                value: m.totalCents,
                displayValue: formatCents(m.totalCents),
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
