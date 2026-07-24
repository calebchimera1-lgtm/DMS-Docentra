"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Boxes, Layers, Warehouse as WarehouseIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { apiClient } from "../../../lib/api-client";
import { formatCents } from "../../../lib/format";
import type { InventorySummary, MovementsByType } from "../../../lib/types";
import { InventorySubnav } from "../../../components/inventory/inventory-subnav";
import { StageBarChart } from "../../../components/crm/stage-bar-chart";
import { StatTile } from "../../../components/stat-tile";

const TYPE_LABELS: Record<string, string> = {
  RECEIPT: "Receipt",
  SALE: "Sale",
  ADJUSTMENT: "Adjustment",
  TRANSFER_IN: "Transfer in",
  TRANSFER_OUT: "Transfer out",
  RETURN: "Return",
};

export default function InventoryOverviewPage() {
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [byType, setByType] = useState<MovementsByType | null>(null);

  useEffect(() => {
    void apiClient.get<InventorySummary>("/inventory/reports/summary").then(setSummary);
    void apiClient.get<MovementsByType>("/inventory/reports/movements-by-type").then(setByType);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Inventory</h1>
        <p className="text-sm text-muted-foreground">Warehouses, stock levels, and stock movements.</p>
      </div>

      <InventorySubnav />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Warehouses" value={summary?.warehouseCount ?? "—"} icon={WarehouseIcon} />
        <StatTile label="Tracked items" value={summary?.trackedItemCount ?? "—"} icon={Boxes} />
        <StatTile
          label="Stock value"
          value={summary ? formatCents(summary.totalStockValueCents) : "—"}
          icon={Layers}
        />
        <StatTile label="Low stock" value={summary?.lowStockCount ?? "—"} icon={AlertTriangle} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movements by type</CardTitle>
        </CardHeader>
        <CardContent>
          {byType ? (
            <StageBarChart
              ariaLabel="Stock movement count by type"
              data={byType.types.map((t) => ({
                label: TYPE_LABELS[t.type] ?? t.type,
                value: t.count,
                displayValue: String(t.count),
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
