"use client";

import { useEffect, useState } from "react";
import { Car, Route, Wrench, Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { apiClient } from "../../../lib/api-client";
import type { FleetSummary, VehiclesByStatus } from "../../../lib/types";
import { FleetSubnav } from "../../../components/fleet/fleet-subnav";
import { StageBarChart } from "../../../components/crm/stage-bar-chart";
import { StatTile } from "../../../components/stat-tile";

export default function FleetOverviewPage() {
  const [summary, setSummary] = useState<FleetSummary | null>(null);
  const [byStatus, setByStatus] = useState<VehiclesByStatus[] | null>(null);

  useEffect(() => {
    void apiClient.get<FleetSummary>("/fleet/reports/summary").then(setSummary);
    void apiClient.get<VehiclesByStatus[]>("/fleet/reports/by-status").then(setByStatus);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Fleet Management</h1>
        <p className="text-sm text-muted-foreground">
          Vehicles, trips, and maintenance jobs that keep the fleet running.
        </p>
      </div>

      <FleetSubnav />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active vehicles" value={summary?.activeCount ?? "—"} icon={Car} />
        <StatTile label="In maintenance" value={summary?.inMaintenanceCount ?? "—"} icon={Wrench} />
        <StatTile label="Trips in progress" value={summary?.tripsInProgressCount ?? "—"} icon={Route} />
        <StatTile label="Total distance all-time" value={summary?.totalDistanceAllTime ?? "—"} icon={Gauge} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vehicles by status</CardTitle>
        </CardHeader>
        <CardContent>
          {byStatus ? (
            <StageBarChart
              ariaLabel="Vehicle count by status"
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
