"use client";

import { useEffect, useState } from "react";
import { Boxes, ClipboardList, Hammer, PackageCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { apiClient } from "../../../lib/api-client";
import type { ManufacturingSummary, WorkOrdersByStatus } from "../../../lib/types";
import { ManufacturingSubnav } from "../../../components/manufacturing/manufacturing-subnav";
import { StageBarChart } from "../../../components/crm/stage-bar-chart";
import { StatTile } from "../../../components/stat-tile";

export default function ManufacturingOverviewPage() {
  const [summary, setSummary] = useState<ManufacturingSummary | null>(null);
  const [byStatus, setByStatus] = useState<WorkOrdersByStatus[] | null>(null);

  useEffect(() => {
    void apiClient.get<ManufacturingSummary>("/manufacturing/reports/summary").then(setSummary);
    void apiClient.get<WorkOrdersByStatus[]>("/manufacturing/reports/by-status").then(setByStatus);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Manufacturing</h1>
        <p className="text-sm text-muted-foreground">
          Bills of material and work orders that consume components and produce finished goods.
        </p>
      </div>

      <ManufacturingSubnav />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Draft work orders" value={summary?.draftCount ?? "—"} icon={ClipboardList} />
        <StatTile label="In progress" value={summary?.inProgressCount ?? "—"} icon={Hammer} />
        <StatTile label="Completed all-time" value={summary?.completedCount ?? "—"} icon={PackageCheck} />
        <StatTile label="Active BOMs" value={summary?.activeBomCount ?? "—"} icon={Boxes} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Work orders by status</CardTitle>
        </CardHeader>
        <CardContent>
          {byStatus ? (
            <StageBarChart
              ariaLabel="Work order count by status"
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
