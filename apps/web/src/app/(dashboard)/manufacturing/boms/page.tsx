"use client";

import { Fragment, useEffect, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input, Pagination } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv } from "../../../../lib/format";
import type { Bom, Paginated, Product } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { ManufacturingSubnav } from "../../../../components/manufacturing/manufacturing-subnav";

interface DraftBomLine {
  componentProductId: string;
  quantity: string;
}

function emptyLine(): DraftBomLine {
  return { componentProductId: "", quantity: "1" };
}

export default function BomsPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.MANUFACTURING_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<Bom> | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [productId, setProductId] = useState("");
  const [name, setName] = useState("");
  const [lines, setLines] = useState<DraftBomLine[]>([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const qs = new URLSearchParams({ page: String(page), pageSize: "50" });
    void apiClient.get<Paginated<Bom>>(`/manufacturing/boms?${qs}`).then(setResult);
  };

  useEffect(load, [page]);
  useEffect(() => {
    void apiClient.get<Paginated<Product>>("/sales/products?page=1&pageSize=100").then((r) => setProducts(r.items));
  }, []);

  function updateLine(index: number, patch: Partial<DraftBomLine>) {
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
      const payload = lines
        .filter((l) => l.componentProductId)
        .map((l) => ({ componentProductId: l.componentProductId, quantity: Math.max(1, parseInt(l.quantity, 10) || 1) }));
      await apiClient.post("/manufacturing/boms", { productId, name, lines: payload });
      setProductId("");
      setName("");
      setLines([emptyLine()]);
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create bill of material");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/manufacturing/boms/export");
    downloadCsv(csv, "boms.csv");
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

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-1 h-3.5 w-3.5" />
          Export CSV
        </Button>
        {canWrite && (
          <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New BOM
          </Button>
        )}
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-3">
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                  required
                >
                  <option value="">Finished product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </select>
                <Input placeholder="Recipe name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-[1fr_100px_32px] gap-2 text-xs font-medium text-muted-foreground">
                  <span>Component</span>
                  <span>Qty per unit</span>
                  <span />
                </div>
                {lines.map((line, index) => (
                  <div key={index} className="grid grid-cols-[1fr_100px_32px] items-center gap-2">
                    <select
                      value={line.componentProductId}
                      onChange={(e) => updateLine(index, { componentProductId: e.target.value })}
                      className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                    >
                      <option value="">Select component…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} — {p.name}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, { quantity: e.target.value })}
                    />
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeLine(index)} aria-label="Remove line">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => setLines([...lines, emptyLine()])}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add component
                </Button>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={submitting} className="self-start">
                {submitting ? "Creating…" : "Create BOM"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Finished product</th>
                <th className="p-3 font-medium">Components</th>
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
                    No bills of material yet.
                  </td>
                </tr>
              ) : (
                result.items.map((bom) => (
                  <Fragment key={bom.id}>
                    <tr
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                      onClick={() => setExpandedId(expandedId === bom.id ? null : bom.id)}
                    >
                      <td className="p-3 font-medium text-foreground">{bom.name}</td>
                      <td className="p-3 text-muted-foreground">
                        {bom.product.sku} — {bom.product.name}
                      </td>
                      <td className="p-3 text-muted-foreground">{bom.lines.length}</td>
                      <td className="p-3">
                        <Badge variant={bom.isActive ? "default" : "outline"}>{bom.isActive ? "Active" : "Inactive"}</Badge>
                      </td>
                    </tr>
                    {expandedId === bom.id && (
                      <tr className="border-b border-border bg-muted/30">
                        <td colSpan={4} className="p-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-muted-foreground">
                                <th className="pb-1 pr-4">Component</th>
                                <th className="pb-1">Quantity per unit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bom.lines.map((line) => (
                                <tr key={line.id}>
                                  <td className="py-1 pr-4">
                                    {line.componentProduct.sku} — {line.componentProduct.name}
                                  </td>
                                  <td className="py-1">{line.quantity}</td>
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
