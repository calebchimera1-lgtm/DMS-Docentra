"use client";

import { useEffect, useState } from "react";
import { Archive, Banknote, Boxes, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { apiClient } from "../../../lib/api-client";
import { formatCents } from "../../../lib/format";
import type { AssetsByCategory, AssetsSummary } from "../../../lib/types";
import { AssetsSubnav } from "../../../components/assets/assets-subnav";
import { StageBarChart } from "../../../components/crm/stage-bar-chart";
import { StatTile } from "../../../components/stat-tile";

export default function AssetsOverviewPage() {
  const [summary, setSummary] = useState<AssetsSummary | null>(null);
  const [byCategory, setByCategory] = useState<AssetsByCategory[] | null>(null);

  useEffect(() => {
    void apiClient.get<AssetsSummary>("/assets/reports/summary").then(setSummary);
    void apiClient.get<AssetsByCategory[]>("/assets/reports/by-category").then(setByCategory);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Assets</h1>
        <p className="text-sm text-muted-foreground">
          Fixed asset register, straight-line depreciation, and disposals.
        </p>
      </div>

      <AssetsSubnav />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active assets" value={summary?.activeAssetCount ?? "—"} icon={Boxes} />
        <StatTile label="Disposed assets" value={summary?.disposedAssetCount ?? "—"} icon={Archive} />
        <StatTile
          label="Accumulated depreciation"
          value={summary ? formatCents(summary.totalAccumulatedDepreciationCents) : "—"}
          icon={TrendingDown}
        />
        <StatTile
          label="Net book value"
          value={summary ? formatCents(summary.totalNetBookValueCents) : "—"}
          icon={Banknote}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Net book value by category</CardTitle>
        </CardHeader>
        <CardContent>
          {byCategory ? (
            byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active assets yet.</p>
            ) : (
              <StageBarChart
                ariaLabel="Net book value by category"
                data={byCategory.map((c) => ({
                  label: `${c.categoryName} (${c.assetCount})`,
                  value: c.netBookValueCents,
                  displayValue: formatCents(c.netBookValueCents),
                }))}
              />
            )
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
