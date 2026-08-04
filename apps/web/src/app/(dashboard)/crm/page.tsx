"use client";

import { useEffect, useState } from "react";
import { Briefcase, Building2, Contact2, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { apiClient } from "../../../lib/api-client";
import { formatCents } from "../../../lib/format";
import type { CrmPipeline, CrmSummary } from "../../../lib/types";
import { CrmSubnav } from "../../../components/crm/crm-subnav";
import { StageBarChart } from "../../../components/crm/stage-bar-chart";
import { StatTile } from "../../../components/stat-tile";

const STAGE_LABELS: Record<string, string> = {
  PROSPECTING: "Prospecting",
  QUALIFICATION: "Qualification",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

export default function CrmOverviewPage() {
  const [summary, setSummary] = useState<CrmSummary | null>(null);
  const [pipeline, setPipeline] = useState<CrmPipeline | null>(null);

  useEffect(() => {
    void apiClient.get<CrmSummary>("/crm/reports/summary").then(setSummary);
    void apiClient.get<CrmPipeline>("/crm/reports/pipeline").then(setPipeline);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">CRM</h1>
        <p className="text-sm text-muted-foreground">Accounts, contacts, leads, and the sales pipeline.</p>
      </div>

      <CrmSubnav />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Accounts" value={summary?.accountCount ?? "—"} icon={Building2} />
        <StatTile label="Contacts" value={summary?.contactCount ?? "—"} icon={Contact2} />
        <StatTile label="Open leads" value={summary?.openLeadCount ?? "—"} icon={UserPlus} />
        <StatTile label="Open deals" value={summary?.openDealCount ?? "—"} icon={Briefcase} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline by stage</CardTitle>
          </CardHeader>
          <CardContent>
            {pipeline ? (
              <StageBarChart
                ariaLabel="Deal value by pipeline stage"
                data={pipeline.stages.map((s) => ({
                  label: STAGE_LABELS[s.stage] ?? s.stage,
                  value: s.totalValueCents,
                  displayValue: formatCents(s.totalValueCents),
                }))}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open pipeline value</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-3xl font-semibold text-foreground">
              {summary ? formatCents(summary.openPipelineValueCents) : "—"}
            </p>
            <p className="text-sm text-muted-foreground">
              Won to date: {summary ? formatCents(summary.wonValueCents) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
