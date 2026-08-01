"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input, Pagination } from "@omniflow/ui";
import { apiClient } from "../../../../lib/api-client";
import type { Paginated, Warehouse } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { InventorySubnav } from "../../../../components/inventory/inventory-subnav";

export default function WarehousesPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.INVENTORY_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<Warehouse> | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const qs = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (search) qs.set("search", search);
    void apiClient.get<Paginated<Warehouse>>(`/inventory/warehouses?${qs}`).then(setResult);
  };

  useEffect(load, [search, page]);
  useEffect(() => setPage(1), [search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/inventory/warehouses", { name, code });
      setName("");
      setCode("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create warehouse");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Inventory</h1>
        <p className="text-sm text-muted-foreground">Warehouses, stock levels, and stock movements.</p>
      </div>

      <InventorySubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Search warehouses…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        {canWrite && (
          <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New warehouse
          </Button>
        )}
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} required />
              <Button type="submit" disabled={submitting} className="sm:col-start-3">
                {submitting ? "Creating…" : "Create warehouse"}
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
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Code</th>
                <th className="p-3 font-medium">Tracked items</th>
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
                    No warehouses yet.
                  </td>
                </tr>
              ) : (
                result.items.map((w) => (
                  <tr key={w.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">{w.name}</td>
                    <td className="p-3 text-muted-foreground">{w.code}</td>
                    <td className="p-3 text-muted-foreground">{w._count?.stockItems ?? 0}</td>
                    <td className="p-3">
                      <Badge variant={w.isActive ? "default" : "outline"}>
                        {w.isActive ? "Active" : "Inactive"}
                      </Badge>
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
