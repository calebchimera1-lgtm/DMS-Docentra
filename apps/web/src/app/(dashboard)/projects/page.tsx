"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, FolderKanban, ListTodo, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { apiClient } from "../../../lib/api-client";
import type { ProjectsSummary, TasksByStatus } from "../../../lib/types";
import { ProjectsSubnav } from "../../../components/projects/projects-subnav";
import { StageBarChart } from "../../../components/crm/stage-bar-chart";
import { StatTile } from "../../../components/stat-tile";

const STATUS_LABELS: Record<string, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
};

function formatHours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`;
}

export default function ProjectsOverviewPage() {
  const [summary, setSummary] = useState<ProjectsSummary | null>(null);
  const [byStatus, setByStatus] = useState<TasksByStatus[] | null>(null);

  useEffect(() => {
    void apiClient.get<ProjectsSummary>("/projects/reports/summary").then(setSummary);
    void apiClient.get<TasksByStatus[]>("/projects/reports/tasks-by-status").then(setByStatus);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Projects</h1>
        <p className="text-sm text-muted-foreground">Projects, tasks, and logged time.</p>
      </div>

      <ProjectsSubnav />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Active projects" value={summary?.activeProjectCount ?? "—"} icon={FolderKanban} />
        <StatTile label="Total projects" value={summary?.totalProjectCount ?? "—"} icon={FolderKanban} />
        <StatTile label="Open tasks" value={summary?.openTaskCount ?? "—"} icon={ListTodo} />
        <StatTile label="Overdue tasks" value={summary?.overdueTaskCount ?? "—"} icon={AlertTriangle} />
        <StatTile
          label="Hours logged"
          value={summary ? formatHours(summary.totalMinutesLogged) : "—"}
          icon={Timer}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tasks by status</CardTitle>
        </CardHeader>
        <CardContent>
          {byStatus ? (
            <StageBarChart
              ariaLabel="Task count by status"
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
