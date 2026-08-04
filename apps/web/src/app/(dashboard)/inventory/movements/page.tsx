"use client";

import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input, Pagination } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv } from "../../../../lib/format";
import type { Paginated, Product, StockMovement, StockMovementType, Warehouse } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { InventorySubnav } from "../../../../components/inventory/inventory-subnav";

const TYPES: StockMovementType[] = ["RECEIPT", "SALE", "ADJUSTMENT", "TRANSFER_IN", "TRANSFER_OUT", "RETURN"];

export default function MovementsPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.INVENTORY_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<StockMovement> | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [type, setType] = useState<StockMovementType>("RECEIPT");
  const [quantity, setQuantity] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const qs = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (typeFilter) qs.set("type", typeFilter);
    void apiClient.get<Paginated<StockMovement>>(`/inventory/movements?${qs}`).then(setResult);
  };

  useEffect(load, [typeFilter, page]);
  useEffect(() => setPage(1), [typeFilter]);
  useEffect(() => {
    void apiClient.get<Paginated<Product>>("/sales/products?page=1&pageSize=100").then((r) => setProducts(r.items));
    void apiClient
      .get<Paginated<Warehouse>>("/inventory/warehouses?page=1&pageSize=100")
      .then((r) => setWarehouses(r.items));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/inventory/movements", {
        productId,
        warehouseId,
        type,
        quantity: parseInt(quantity, 10),
        reference: reference || undefined,
      });
      setQuantity("");
      setReference("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record movement");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/inventory/movements/export");
    downloadCsv(csv, "stock-movements.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Inventory</h1>
        <p className="text-sm text-muted-foreground">Warehouses, stock levels, and stock movements.</p>
      </div>

      <InventorySubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
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
              New movement
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-5">
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                required
              >
                <option value="">Product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
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
              <select
                value={type}
                onChange={(e) => setType(e.target.value as StockMovementType)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <Input
                placeholder={type === "ADJUSTMENT" ? "Signed qty (e.g. -2)" : "Quantity"}
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
              <Input placeholder="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />
              <Button type="submit" disabled={submitting} className="sm:col-span-5 sm:w-fit">
                {submitting ? "Recording…" : "Record movement"}
              </Button>
            </form>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">Product</th>
                <th className="p-3 font-medium">Warehouse</th>
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 font-medium">Qty</th>
                <th className="p-3 font-medium">Reference</th>
                <th className="p-3 font-medium">When</th>
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
                    No movements recorded yet.
                  </td>
                </tr>
              ) : (
                result.items.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">{m.product.sku}</td>
                    <td className="p-3 text-muted-foreground">{m.warehouse.name}</td>
                    <td className="p-3">
                      <Badge variant="outline">{m.type}</Badge>
                    </td>
                    <td className={`p-3 font-medium ${m.quantity < 0 ? "text-red-600" : "text-foreground"}`}>
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td className="p-3 text-muted-foreground">{m.reference ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</td>
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
