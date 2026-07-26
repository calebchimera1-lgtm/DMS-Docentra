"use client";

import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv } from "../../../../lib/format";
import type { Paginated, Supplier } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { PurchaseSubnav } from "../../../../components/purchase/purchase-subnav";

export default function SuppliersPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.PURCHASE_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<Supplier> | null>(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const qs = new URLSearchParams({ page: "1", pageSize: "50" });
    if (search) qs.set("search", search);
    void apiClient.get<Paginated<Supplier>>(`/purchase/suppliers?${qs}`).then(setResult);
  };

  useEffect(load, [search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/purchase/suppliers", { name, code, email: email || undefined });
      setName("");
      setCode("");
      setEmail("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create supplier");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/purchase/suppliers/export");
    downloadCsv(csv, "suppliers.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Purchase</h1>
        <p className="text-sm text-muted-foreground">Suppliers, purchase orders, and goods receipts.</p>
      </div>

      <PurchaseSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Search suppliers…"
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
              New supplier
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input placeholder="Code (e.g. ACME)" value={code} onChange={(e) => setCode(e.target.value)} required />
              <Input placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button type="submit" disabled={submitting} className="sm:col-start-4">
                {submitting ? "Creating…" : "Create supplier"}
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
                <th className="p-3 font-medium">Code</th>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Email</th>
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
                    No suppliers yet.
                  </td>
                </tr>
              ) : (
                result.items.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">{s.code}</td>
                    <td className="p-3 text-muted-foreground">{s.name}</td>
                    <td className="p-3 text-muted-foreground">{s.email ?? "—"}</td>
                    <td className="p-3">
                      <Badge variant={s.isActive ? "default" : "outline"}>{s.isActive ? "Active" : "Inactive"}</Badge>
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
