"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input, Pagination } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv } from "../../../../lib/format";
import type { Paginated, Product, Shipment, ShipmentStatus, Vehicle, Warehouse } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { LogisticsSubnav } from "../../../../components/logistics/logistics-subnav";

interface DraftLine {
  productId: string;
  description: string;
  quantity: string;
  unitPriceCents: string;
}

function emptyLine(): DraftLine {
  return { productId: "", description: "", quantity: "1", unitPriceCents: "0" };
}

export default function ShipmentsPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.LOGISTICS_WRITE) ?? false;
  const canDelete = user?.effectivePermissions.includes(PERMISSIONS.LOGISTICS_DELETE) ?? false;

  const [result, setResult] = useState<Paginated<Shipment> | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | "">("");
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [failingId, setFailingId] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState("");

  const load = () => {
    const qs = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (statusFilter) qs.set("status", statusFilter);
    void apiClient.get<Paginated<Shipment>>(`/logistics/shipments?${qs}`).then(setResult);
  };

  useEffect(load, [statusFilter, page]);
  useEffect(() => setPage(1), [statusFilter]);
  useEffect(() => {
    void apiClient.get<Paginated<Warehouse>>("/inventory/warehouses?page=1&pageSize=100").then((r) => setWarehouses(r.items));
    void apiClient
      .get<Paginated<Vehicle>>("/fleet/vehicles?page=1&pageSize=100&status=ACTIVE")
      .then((r) => setVehicles(r.items));
    void apiClient.get<Paginated<Product>>("/sales/products?page=1&pageSize=100").then((r) => setProducts(r.items));
  }, []);

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number) {
    setLines(lines.length > 1 ? lines.filter((_, i) => i !== index) : lines);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const items = lines
        .filter((l) => l.description)
        .map((l) => ({
          productId: l.productId || undefined,
          description: l.description,
          quantity: Math.max(1, parseInt(l.quantity, 10) || 1),
          unitPriceCents: Math.max(0, parseInt(l.unitPriceCents, 10) || 0),
        }));
      await apiClient.post("/logistics/shipments", {
        warehouseId,
        vehicleId: vehicleId || undefined,
        destinationAddress,
        contactName: contactName || undefined,
        items,
      });
      setWarehouseId("");
      setVehicleId("");
      setDestinationAddress("");
      setContactName("");
      setLines([emptyLine()]);
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create shipment");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(id: string, action: "dispatch" | "in-transit" | "deliver" | "cancel") {
    setActionError(null);
    try {
      await apiClient.post(`/logistics/shipments/${id}/${action}`, {});
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : `Failed to ${action} shipment`);
    }
  }

  async function handleFail(id: string) {
    setActionError(null);
    try {
      await apiClient.post(`/logistics/shipments/${id}/fail`, { failureReason: failureReason || "Delivery failed" });
      setFailingId(null);
      setFailureReason("");
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to mark shipment failed");
    }
  }

  async function handleDelete(id: string) {
    setActionError(null);
    try {
      await apiClient.delete(`/logistics/shipments/${id}`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete shipment");
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/logistics/shipments/export");
    downloadCsv(csv, "shipments.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Logistics</h1>
        <p className="text-sm text-muted-foreground">
          Shipments from warehouse to doorstep, with a full delivery tracking timeline.
        </p>
      </div>

      <LogisticsSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ShipmentStatus | "")}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="DISPATCHED">Dispatched</option>
          <option value="IN_TRANSIT">In transit</option>
          <option value="DELIVERED">Delivered</option>
          <option value="FAILED">Failed</option>
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
              New shipment
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                  required
                >
                  <option value="">Origin warehouse…</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <select
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="">Vehicle (optional)…</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.registrationNumber} ({v.make} {v.model})
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Destination address"
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  required
                />
                <Input placeholder="Contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </div>

              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-[1fr_1fr_90px_110px_32px] gap-2 text-xs font-medium text-muted-foreground">
                  <span>Product</span>
                  <span>Description</span>
                  <span>Qty</span>
                  <span>Unit price (cents)</span>
                  <span />
                </div>
                {lines.map((line, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1fr_90px_110px_32px] items-center gap-2">
                    <select
                      value={line.productId}
                      onChange={(e) => {
                        const product = products.find((p) => p.id === e.target.value);
                        updateLine(index, {
                          productId: e.target.value,
                          description: product ? product.name : line.description,
                        });
                      }}
                      className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                    >
                      <option value="">No product…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} — {p.name}
                        </option>
                      ))}
                    </select>
                    <Input
                      placeholder="Description"
                      value={line.description}
                      onChange={(e) => updateLine(index, { description: e.target.value })}
                    />
                    <Input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, { quantity: e.target.value })}
                    />
                    <Input
                      type="number"
                      min="0"
                      value={line.unitPriceCents}
                      onChange={(e) => updateLine(index, { unitPriceCents: e.target.value })}
                    />
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeLine(index)} aria-label="Remove line">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="self-start"
                  onClick={() => setLines([...lines, emptyLine()])}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add line
                </Button>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={submitting} className="self-start">
                {submitting ? "Creating…" : "Create shipment"}
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
                <th className="p-3 font-medium">Shipment</th>
                <th className="p-3 font-medium">Destination</th>
                <th className="p-3 font-medium">Warehouse</th>
                <th className="p-3 font-medium">Vehicle</th>
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
                    No shipments yet.
                  </td>
                </tr>
              ) : (
                result.items.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">
                      <Link href={`/logistics/shipments/${s.id}`} className="hover:underline">
                        {s.shipmentNumber}
                      </Link>
                    </td>
                    <td className="p-3 text-muted-foreground">{s.destinationAddress}</td>
                    <td className="p-3 text-muted-foreground">{s.warehouse.name}</td>
                    <td className="p-3 text-muted-foreground">{s.vehicle?.registrationNumber ?? "—"}</td>
                    <td className="p-3">
                      <Badge variant={s.status === "DELIVERED" ? "default" : "outline"}>{s.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        {canWrite && s.status === "DRAFT" && (
                          <>
                            <Button type="button" size="sm" onClick={() => handleAction(s.id, "dispatch")}>
                              Dispatch
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => handleAction(s.id, "cancel")}>
                              Cancel
                            </Button>
                          </>
                        )}
                        {canWrite && s.status === "DISPATCHED" && (
                          <Button type="button" size="sm" variant="outline" onClick={() => handleAction(s.id, "in-transit")}>
                            In transit
                          </Button>
                        )}
                        {canWrite && (s.status === "DISPATCHED" || s.status === "IN_TRANSIT") && (
                          <>
                            <Button type="button" size="sm" onClick={() => handleAction(s.id, "deliver")}>
                              Deliver
                            </Button>
                            {failingId === s.id ? (
                              <>
                                <Input
                                  placeholder="Reason"
                                  value={failureReason}
                                  onChange={(e) => setFailureReason(e.target.value)}
                                  className="h-9 w-40"
                                />
                                <Button type="button" size="sm" variant="destructive" onClick={() => handleFail(s.id)}>
                                  Confirm
                                </Button>
                              </>
                            ) : (
                              <Button type="button" size="sm" variant="outline" onClick={() => setFailingId(s.id)}>
                                Fail
                              </Button>
                            )}
                          </>
                        )}
                        {canDelete && (s.status === "DRAFT" || s.status === "CANCELLED") && (
                          <Button type="button" size="sm" variant="destructive" onClick={() => handleDelete(s.id)}>
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {result && (
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              total={result.total}
              pageSize={result.pageSize}
              onPageChange={setPage}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
