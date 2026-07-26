"use client";

import { Fragment, useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv, formatCents } from "../../../../lib/format";
import type { Paginated, PurchaseOrder, Supplier, Warehouse } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { PurchaseSubnav } from "../../../../components/purchase/purchase-subnav";
import {
  DraftLineItem,
  LineItemsEditor,
  emptyLineItem,
  toLineItemPayload,
} from "../../../../components/sales/line-items-editor";

const STATUS_OPTIONS = ["DRAFT", "SENT", "CONFIRMED", "RECEIVED", "CANCELLED"];

export default function PurchaseOrdersPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.PURCHASE_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<PurchaseOrder> | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [status, setStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [items, setItems] = useState<DraftLineItem[]>([emptyLineItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = () => {
    const qs = new URLSearchParams({ page: "1", pageSize: "50" });
    if (status) qs.set("status", status);
    void apiClient.get<Paginated<PurchaseOrder>>(`/purchase/orders?${qs}`).then(setResult);
  };

  useEffect(load, [status]);
  useEffect(() => {
    void apiClient.get<Paginated<Supplier>>("/purchase/suppliers?page=1&pageSize=100").then((r) => setSuppliers(r.items));
    void apiClient.get<Paginated<Warehouse>>("/inventory/warehouses?page=1&pageSize=100").then((r) => setWarehouses(r.items));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = toLineItemPayload(items);
      await apiClient.post("/purchase/orders", { supplierId, warehouseId, items: payload });
      setItems([emptyLineItem()]);
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create purchase order");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id: string, next: string) {
    setActionError(null);
    try {
      await apiClient.patch(`/purchase/orders/${id}`, { status: next });
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update status");
    }
  }

  async function handleReceive(id: string) {
    setActionError(null);
    try {
      await apiClient.post(`/purchase/orders/${id}/receive`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to receive purchase order");
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/purchase/orders/export");
    downloadCsv(csv, "purchase-orders.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Purchase</h1>
        <p className="text-sm text-muted-foreground">Suppliers, purchase orders, and goods receipts.</p>
      </div>

      <PurchaseSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
          {canWrite && (
            <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New order
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-3">
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                  required
                >
                  <option value="">Select supplier…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                  required
                >
                  <option value="">Receiving warehouse…</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <LineItemsEditor items={items} onChange={setItems} />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={submitting} className="self-start">
                {submitting ? "Creating…" : "Create draft order"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">Order #</th>
                <th className="p-3 font-medium">Supplier</th>
                <th className="p-3 font-medium">Warehouse</th>
                <th className="p-3 font-medium">Total</th>
                <th className="p-3 font-medium">Status</th>
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
                    No purchase orders yet.
                  </td>
                </tr>
              ) : (
                result.items.map((po) => (
                  <Fragment key={po.id}>
                    <tr
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                      onClick={() => setExpandedId(expandedId === po.id ? null : po.id)}
                    >
                      <td className="p-3 font-medium text-foreground">{po.orderNumber}</td>
                      <td className="p-3 text-muted-foreground">{po.supplier.name}</td>
                      <td className="p-3 text-muted-foreground">{po.warehouse?.name ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">{formatCents(po.totalCents, po.currency)}</td>
                      <td className="p-3">
                        <Badge variant={po.status === "RECEIVED" ? "default" : "outline"}>{po.status}</Badge>
                      </td>
                      <td className="p-3 text-right">
                        {canWrite && po.status === "DRAFT" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(po.id, "SENT");
                            }}
                          >
                            Send
                          </Button>
                        )}
                        {canWrite && po.status === "SENT" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(po.id, "CONFIRMED");
                            }}
                          >
                            Confirm
                          </Button>
                        )}
                        {canWrite && po.status === "CONFIRMED" && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReceive(po.id);
                            }}
                          >
                            Receive
                          </Button>
                        )}
                      </td>
                    </tr>
                    {expandedId === po.id && (
                      <tr className="border-b border-border bg-muted/30">
                        <td colSpan={6} className="p-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-muted-foreground">
                                <th className="pb-1 pr-4">Description</th>
                                <th className="pb-1 pr-4">Qty</th>
                                <th className="pb-1 pr-4">Unit cost</th>
                                <th className="pb-1">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {po.items.map((line, i) => (
                                <tr key={i}>
                                  <td className="py-1 pr-4">{line.description}</td>
                                  <td className="py-1 pr-4">{line.quantity}</td>
                                  <td className="py-1 pr-4">{formatCents(line.unitPriceCents, po.currency)}</td>
                                  <td className="py-1">{formatCents(line.totalCents, po.currency)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
