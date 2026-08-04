"use client";

import { useEffect, useState } from "react";
import { Briefcase, CalendarCheck, UserCheck, Users2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { apiClient } from "../../../lib/api-client";
import type { ApplicationsByStatus, RecruitmentSummary } from "../../../lib/types";
import { RecruitmentSubnav } from "../../../components/recruitment/recruitment-subnav";
import { StageBarChart } from "../../../components/crm/stage-bar-chart";
import { StatTile } from "../../../components/stat-tile";

const STATUS_LABELS: Record<string, string> = {
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEWING: "Interviewing",
  OFFERED: "Offered",
  HIRED: "Hired",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export default function RecruitmentOverviewPage() {
  const [summary, setSummary] = useState<RecruitmentSummary | null>(null);
  const [byStatus, setByStatus] = useState<ApplicationsByStatus[] | null>(null);

  useEffect(() => {
    void apiClient.get<RecruitmentSummary>("/recruitment/reports/summary").then(setSummary);
    void apiClient.get<ApplicationsByStatus[]>("/recruitment/reports/applications-by-status").then(setByStatus);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Recruitment</h1>
        <p className="text-sm text-muted-foreground">
          Job postings, candidates, and the application pipeline through to hire.
        </p>
      </div>

      <RecruitmentSubnav />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Open postings" value={summary?.openPostingCount ?? "—"} icon={Briefcase} />
        <StatTile label="Active applications" value={summary?.activeApplicationCount ?? "—"} icon={Users2} />
        <StatTile label="Scheduled interviews" value={summary?.scheduledInterviewCount ?? "—"} icon={CalendarCheck} />
        <StatTile label="Hired all-time" value={summary?.hiredCount ?? "—"} icon={UserCheck} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Applications by status</CardTitle>
        </CardHeader>
        <CardContent>
          {byStatus ? (
            <StageBarChart
              ariaLabel="Application count by pipeline status"
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
