"use client";

import { useEffect, useState } from "react";
import { FileStack, FolderTree, History, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { apiClient } from "../../../lib/api-client";
import type { DocumentsByStatus, DocumentsSummary } from "../../../lib/types";
import { DocumentsSubnav } from "../../../components/documents/documents-subnav";
import { StageBarChart } from "../../../components/crm/stage-bar-chart";
import { StatTile } from "../../../components/stat-tile";

export default function DocumentsOverviewPage() {
  const [summary, setSummary] = useState<DocumentsSummary | null>(null);
  const [byStatus, setByStatus] = useState<DocumentsByStatus[] | null>(null);

  useEffect(() => {
    void apiClient.get<DocumentsSummary>("/documents/reports/summary").then(setSummary);
    void apiClient.get<DocumentsByStatus[]>("/documents/reports/by-status").then(setByStatus);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Documents</h1>
        <p className="text-sm text-muted-foreground">
          Controlled documents with version history and exclusive check-out.
        </p>
      </div>

      <DocumentsSubnav />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Published" value={summary?.publishedCount ?? "—"} icon={FileStack} />
        <StatTile label="Checked out" value={summary?.checkedOutCount ?? "—"} icon={Lock} />
        <StatTile label="Folders" value={summary?.folderCount ?? "—"} icon={FolderTree} />
        <StatTile label="Total versions" value={summary?.versionCount ?? "—"} icon={History} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documents by status</CardTitle>
        </CardHeader>
        <CardContent>
          {byStatus ? (
            <StageBarChart
              ariaLabel="Document count by status"
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
