"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, LifeBuoy, TicketIcon, UserX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { apiClient } from "../../../lib/api-client";
import type { SupportSummary, TicketsByStatus } from "../../../lib/types";
import { SupportSubnav } from "../../../components/support/support-subnav";
import { StageBarChart } from "../../../components/crm/stage-bar-chart";
import { StatTile } from "../../../components/stat-tile";

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  WAITING_ON_CUSTOMER: "Waiting on customer",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export default function SupportOverviewPage() {
  const [summary, setSummary] = useState<SupportSummary | null>(null);
  const [byStatus, setByStatus] = useState<TicketsByStatus[] | null>(null);

  useEffect(() => {
    void apiClient.get<SupportSummary>("/support/reports/summary").then(setSummary);
    void apiClient.get<TicketsByStatus[]>("/support/reports/tickets-by-status").then(setByStatus);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Support</h1>
        <p className="text-sm text-muted-foreground">Helpdesk tickets.</p>
      </div>

      <SupportSubnav />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Open tickets" value={summary?.openTicketCount ?? "—"} icon={TicketIcon} />
        <StatTile label="Unassigned" value={summary?.unassignedTicketCount ?? "—"} icon={UserX} />
        <StatTile label="Overdue" value={summary?.overdueTicketCount ?? "—"} icon={AlertTriangle} />
        <StatTile label="Total tickets" value={summary?.totalTicketCount ?? "—"} icon={LifeBuoy} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tickets by status</CardTitle>
        </CardHeader>
        <CardContent>
          {byStatus ? (
            <StageBarChart
              ariaLabel="Ticket count by status"
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
