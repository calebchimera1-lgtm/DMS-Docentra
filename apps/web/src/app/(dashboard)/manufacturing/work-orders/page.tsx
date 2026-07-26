"use client";

import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv } from "../../../../lib/format";
import type { Bom, Paginated, Warehouse, WorkOrder, WorkOrderStatus } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { ManufacturingSubnav } from "../../../../components/manufacturing/manufacturing-subnav";

export default function WorkOrdersPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.MANUFACTURING_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<WorkOrder> | null>(null);
  const [boms, setBoms] = useState<Bom[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | "">("");

  const [showCreate, setShowCreate] = useState(false);
  const [bomId, setBomId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [plannedDate, setPlannedDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = () => {
    const qs = new URLSearchParams({ page: "1", pageSize: "50" });
    if (statusFilter) qs.set("status", statusFilter);
    void apiClient.get<Paginated<WorkOrder>>(`/manufacturing/work-orders?${qs}`).then(setResult);
  };

  useEffect(load, [statusFilter]);
  useEffect(() => {
    void apiClient.get<Paginated<Bom>>("/manufacturing/boms?page=1&pageSize=100&isActive=true").then((r) => setBoms(r.items));
    void apiClient.get<Paginated<Warehouse>>("/inventory/warehouses?page=1&pageSize=100").then((r) => setWarehouses(r.items));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/manufacturing/work-orders", {
        bomId,
        warehouseId,
        quantity: Math.max(1, parseInt(quantity, 10) || 1),
        plannedDate: plannedDate || undefined,
      });
      setBomId("");
      setWarehouseId("");
      setQuantity("1");
      setPlannedDate("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create work order");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(id: string, action: "start" | "complete" | "cancel") {
    setActionError(null);
    try {
      await apiClient.post(`/manufacturing/work-orders/${id}/${action}`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : `Failed to ${action} work order`);
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/manufacturing/work-orders/export");
    downloadCsv(csv, "work-orders.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Manufacturing</h1>
        <p className="text-sm text-muted-foreground">
          Bills of material and work orders that consume components and produce finished goods.
        </p>
      </div>

      <ManufacturingSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as WorkOrderStatus | "")}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
          {canWrite && (
            <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New work order
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <select
                value={bomId}
                onChange={(e) => setBomId(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                required
              >
                <option value="">Bill of material…</option>
                {boms.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.product.sku})
                  </option>
                ))}
              </select>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                required
              >
                <option value="">Warehouse…</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min="1"
                placeholder="Quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
              <Input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
              <Button type="submit" disabled={submitting} className="sm:col-start-4">
                {submitting ? "Creating…" : "Create work order"}
              </Button>
            </form>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </CardContent>
        </Card>
      )}

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">Work order</th>
                <th className="p-3 font-medium">BOM</th>
                <th className="p-3 font-medium">Product</th>
                <th className="p-3 font-medium">Warehouse</th>
                <th className="p-3 font-medium">Quantity</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {result === null ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : result.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">
                    No work orders yet.
                  </td>
                </tr>
              ) : (
                result.items.map((wo) => (
                  <tr key={wo.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">{wo.workOrderNumber}</td>
                    <td className="p-3 text-muted-foreground">{wo.bom.name}</td>
                    <td className="p-3 text-muted-foreground">{wo.product.sku}</td>
                    <td className="p-3 text-muted-foreground">{wo.warehouse.name}</td>
                    <td className="p-3 text-muted-foreground">{wo.quantity}</td>
                    <td className="p-3">
                      <Badge variant={wo.status === "COMPLETED" ? "default" : "outline"}>{wo.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      {canWrite && wo.status === "DRAFT" && (
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" onClick={() => handleAction(wo.id, "start")}>
                            Start
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => handleAction(wo.id, "cancel")}>
                            Cancel
                          </Button>
                        </div>
                      )}
                      {canWrite && wo.status === "IN_PROGRESS" && (
                        <Button type="button" size="sm" onClick={() => handleAction(wo.id, "complete")}>
                          Complete
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
