"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input } from "@omniflow/ui";
import { apiClient } from "../../../../lib/api-client";
import { downloadCsv, formatCents } from "../../../../lib/format";
import type { Paginated, SalesOrder, SalesOrderStatus, Warehouse } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { SalesSubnav } from "../../../../components/sales/sales-subnav";

const STATUSES: SalesOrderStatus[] = ["DRAFT", "CONFIRMED", "FULFILLED", "CANCELLED"];
// FULFILLED is set only by the Fulfill action (it deducts stock) — not a
// freeform status a user can flip to from this dropdown.
const EDITABLE_STATUSES: SalesOrderStatus[] = ["DRAFT", "CONFIRMED", "CANCELLED"];

export default function OrdersPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.SALES_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<SalesOrder> | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [fulfillWarehouse, setFulfillWarehouse] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const load = () => {
    const qs = new URLSearchParams({ page: "1", pageSize: "50" });
    if (search) qs.set("search", search);
    if (status) qs.set("status", status);
    void apiClient.get<Paginated<SalesOrder>>(`/sales/orders?${qs}`).then(setResult);
  };

  useEffect(load, [search, status]);
  useEffect(() => {
    void apiClient
      .get<Paginated<Warehouse>>("/inventory/warehouses?page=1&pageSize=100")
      .then((r) => setWarehouses(r.items));
  }, []);

  async function handleStatusChange(id: string, newStatus: string) {
    await apiClient.patch(`/sales/orders/${id}`, { status: newStatus });
    load();
  }

  async function handleConvert(id: string) {
    await apiClient.post(`/sales/orders/${id}/convert-to-invoice`);
    load();
  }

  async function handleFulfill(order: SalesOrder) {
    const warehouseId = fulfillWarehouse[order.id] ?? order.warehouse?.id;
    if (!warehouseId) return;
    await apiClient.post(`/sales/orders/${order.id}/fulfill`, { warehouseId });
    load();
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/sales/orders/export");
    downloadCsv(csv, "sales-orders.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Sales</h1>
        <p className="text-sm text-muted-foreground">Products, quotes, sales orders, and invoices.</p>
      </div>

      <SalesSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search orders…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-1 h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Orders are created by converting an accepted quote — see the Quotes tab. Fulfilling an order deducts
        stock from the chosen warehouse and records the movement.
      </p>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">Order #</th>
                <th className="p-3 font-medium">Account</th>
                <th className="p-3 font-medium">Total</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Fulfillment</th>
                <th className="p-3 font-medium" />
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
                    No sales orders yet.
                  </td>
                </tr>
              ) : (
                result.items.map((o) => {
                  const canFulfill = o.status === "DRAFT" || o.status === "CONFIRMED";
                  const selectedWarehouse = fulfillWarehouse[o.id] ?? o.warehouse?.id ?? "";
                  return (
                    <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="p-3 font-medium text-foreground">{o.orderNumber}</td>
                      <td className="p-3 text-muted-foreground">{o.account?.name ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">{formatCents(o.totalCents, o.currency)}</td>
                      <td className="p-3">
                        {canWrite ? (
                          <select
                            value={o.status}
                            onChange={(e) => handleStatusChange(o.id, e.target.value)}
                            disabled={o.status === "FULFILLED"}
                            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                          >
                            {(EDITABLE_STATUSES.includes(o.status) ? EDITABLE_STATUSES : [o.status]).map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Badge variant="outline">{o.status}</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        {o.status === "FULFILLED" ? (
                          <span className="text-xs text-muted-foreground">{o.warehouse?.name ?? "Fulfilled"}</span>
                        ) : canWrite && canFulfill ? (
                          <div className="flex items-center gap-1">
                            <select
                              value={selectedWarehouse}
                              onChange={(e) =>
                                setFulfillWarehouse((prev) => ({ ...prev, [o.id]: e.target.value }))
                              }
                              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                            >
                              <option value="">Warehouse…</option>
                              {warehouses.map((w) => (
                                <option key={w.id} value={w.id}>
                                  {w.name}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={!selectedWarehouse}
                              onClick={() => handleFulfill(o)}
                            >
                              Fulfill
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {canWrite && !o.invoice && (
                          <Button type="button" size="sm" variant="outline" onClick={() => handleConvert(o.id)}>
                            Convert to invoice
                          </Button>
                        )}
                        {o.invoice && (
                          <span className="text-xs text-muted-foreground">{o.invoice.invoiceNumber}</span>
                        )}
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
