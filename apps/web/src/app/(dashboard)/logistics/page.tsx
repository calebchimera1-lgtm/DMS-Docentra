"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileText, Truck, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { apiClient } from "../../../lib/api-client";
import type { LogisticsSummary, ShipmentsByStatus } from "../../../lib/types";
import { LogisticsSubnav } from "../../../components/logistics/logistics-subnav";
import { StageBarChart } from "../../../components/crm/stage-bar-chart";
import { StatTile } from "../../../components/stat-tile";

export default function LogisticsOverviewPage() {
  const [summary, setSummary] = useState<LogisticsSummary | null>(null);
  const [byStatus, setByStatus] = useState<ShipmentsByStatus[] | null>(null);

  useEffect(() => {
    void apiClient.get<LogisticsSummary>("/logistics/reports/summary").then(setSummary);
    void apiClient.get<ShipmentsByStatus[]>("/logistics/reports/by-status").then(setByStatus);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Logistics</h1>
        <p className="text-sm text-muted-foreground">
          Shipments from warehouse to doorstep, with a full delivery tracking timeline.
        </p>
      </div>

      <LogisticsSubnav />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Draft" value={summary?.draftCount ?? "—"} icon={FileText} />
        <StatTile label="In flight" value={summary?.inFlightCount ?? "—"} icon={Truck} />
        <StatTile label="Delivered" value={summary?.deliveredCount ?? "—"} icon={CheckCircle2} />
        <StatTile label="Failed" value={summary?.failedCount ?? "—"} icon={XCircle} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Delivered rate</CardTitle>
        </CardHeader>
        <CardContent>
          {summary ? (
            <div className="flex flex-col gap-2">
              <p className="text-3xl font-semibold text-foreground">{summary.deliveredRatePercent}%</p>
              <p className="text-sm text-muted-foreground">
                Share of finished delivery attempts that arrived ({summary.deliveredCount} delivered,{" "}
                {summary.failedCount} failed). Draft, in-flight, and cancelled shipments are excluded.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shipments by status</CardTitle>
        </CardHeader>
        <CardContent>
          {byStatus ? (
            <StageBarChart
              ariaLabel="Shipment count by status"
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
