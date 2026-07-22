"use client";

import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input } from "@omniflow/ui";
import { apiClient } from "../../../../lib/api-client";
import { downloadCsv, formatCents } from "../../../../lib/format";
import type { Paginated, Product } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { SalesSubnav } from "../../../../components/sales/sales-subnav";

export default function ProductsPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.SALES_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<Product> | null>(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [priceDollars, setPriceDollars] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const qs = new URLSearchParams({ page: "1", pageSize: "50" });
    if (search) qs.set("search", search);
    void apiClient.get<Paginated<Product>>(`/sales/products?${qs}`).then(setResult);
  };

  useEffect(load, [search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/sales/products", {
        sku,
        name,
        unitPriceCents: Math.round(parseFloat(priceDollars || "0") * 100),
      });
      setSku("");
      setName("");
      setPriceDollars("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/sales/products/export");
    downloadCsv(csv, "products.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Sales</h1>
        <p className="text-sm text-muted-foreground">Products, quotes, sales orders, and invoices.</p>
      </div>

      <SalesSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
          {canWrite && (
            <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New product
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} required />
              <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input
                placeholder="Price (USD)"
                type="number"
                min="0"
                step="0.01"
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
              />
              <Button type="submit" disabled={submitting} className="sm:col-start-4">
                {submitting ? "Creating…" : "Create product"}
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
                <th className="p-3 font-medium">SKU</th>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Price</th>
                <th className="p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {result === null ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : result.items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-muted-foreground">
                    No products yet.
                  </td>
                </tr>
              ) : (
                result.items.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">{p.sku}</td>
                    <td className="p-3 text-muted-foreground">{p.name}</td>
                    <td className="p-3 text-muted-foreground">{formatCents(p.unitPriceCents, p.currency)}</td>
                    <td className="p-3">
                      <Badge variant={p.isActive ? "default" : "outline"}>
                        {p.isActive ? "Active" : "Inactive"}
                      </Badge>
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
