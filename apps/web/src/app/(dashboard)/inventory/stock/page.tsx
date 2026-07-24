"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input } from "@omniflow/ui";
import { apiClient } from "../../../../lib/api-client";
import { downloadCsv, formatCents } from "../../../../lib/format";
import type { Paginated, StockItem, Warehouse } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { InventorySubnav } from "../../../../components/inventory/inventory-subnav";

export default function StockPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.INVENTORY_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<StockItem> | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reorderPointDraft, setReorderPointDraft] = useState("");

  const load = () => {
    const qs = new URLSearchParams({ page: "1", pageSize: "50" });
    if (search) qs.set("search", search);
    if (warehouseId) qs.set("warehouseId", warehouseId);
    if (lowStockOnly) qs.set("lowStock", "true");
    void apiClient.get<Paginated<StockItem>>(`/inventory/stock?${qs}`).then(setResult);
  };

  useEffect(load, [search, warehouseId, lowStockOnly]);
  useEffect(() => {
    void apiClient
      .get<Paginated<Warehouse>>("/inventory/warehouses?page=1&pageSize=100")
      .then((r) => setWarehouses(r.items));
  }, []);

  async function handleSaveReorderPoint(id: string) {
    await apiClient.patch(`/inventory/stock/${id}`, { reorderPoint: parseInt(reorderPointDraft, 10) || 0 });
    setEditingId(null);
    load();
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/inventory/stock/export");
    downloadCsv(csv, "stock-levels.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Inventory</h1>
        <p className="text-sm text-muted-foreground">Warehouses, stock levels, and stock movements.</p>
      </div>

      <InventorySubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search by product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">All warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="h-4 w-4"
            />
            Low stock only
          </label>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-1 h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">SKU</th>
                <th className="p-3 font-medium">Product</th>
                <th className="p-3 font-medium">Warehouse</th>
                <th className="p-3 font-medium">On hand</th>
                <th className="p-3 font-medium">Reorder point</th>
                <th className="p-3 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {result === null ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : result.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    No stock tracked yet.
                  </td>
                </tr>
              ) : (
                result.items.map((s) => {
                  const isLow = s.quantityOnHand <= s.reorderPoint;
                  return (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="p-3 font-medium text-foreground">{s.product.sku}</td>
                      <td className="p-3 text-muted-foreground">{s.product.name}</td>
                      <td className="p-3 text-muted-foreground">{s.warehouse.name}</td>
                      <td className="p-3">
                        <Badge variant={isLow ? "outline" : "default"}>{s.quantityOnHand}</Badge>
                      </td>
                      <td className="p-3">
                        {canWrite && editingId === s.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              value={reorderPointDraft}
                              onChange={(e) => setReorderPointDraft(e.target.value)}
                              className="h-8 w-20"
                            />
                            <Button type="button" size="sm" onClick={() => handleSaveReorderPoint(s.id)}>
                              Save
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="text-muted-foreground hover:underline disabled:no-underline"
                            disabled={!canWrite}
                            onClick={() => {
                              setEditingId(s.id);
                              setReorderPointDraft(String(s.reorderPoint));
                            }}
                          >
                            {s.reorderPoint}
                          </button>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {formatCents(s.quantityOnHand * s.product.unitPriceCents, s.product.currency)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
