"use client";

import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv } from "../../../../lib/format";
import type { AssetCategory, LedgerAccount, Paginated } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { AssetsSubnav } from "../../../../components/assets/assets-subnav";

export default function AssetCategoriesPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.ASSETS_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<AssetCategory> | null>(null);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [usefulLife, setUsefulLife] = useState("36");
  const [assetAccountId, setAssetAccountId] = useState("");
  const [depreciationExpenseAccountId, setDepreciationExpenseAccountId] = useState("");
  const [accumulatedDepreciationAccountId, setAccumulatedDepreciationAccountId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const qs = new URLSearchParams({ page: "1", pageSize: "50" });
    if (search) qs.set("search", search);
    void apiClient.get<Paginated<AssetCategory>>(`/assets/categories?${qs}`).then(setResult);
  };

  useEffect(load, [search]);
  useEffect(() => {
    void apiClient
      .get<Paginated<LedgerAccount>>("/accounting/ledger-accounts?page=1&pageSize=100")
      .then((r) => setLedgerAccounts(r.items));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/assets/categories", {
        name,
        code,
        defaultUsefulLifeMonths: parseInt(usefulLife || "36", 10),
        assetAccountId: assetAccountId || undefined,
        depreciationExpenseAccountId: depreciationExpenseAccountId || undefined,
        accumulatedDepreciationAccountId: accumulatedDepreciationAccountId || undefined,
      });
      setName("");
      setCode("");
      setUsefulLife("36");
      setAssetAccountId("");
      setDepreciationExpenseAccountId("");
      setAccumulatedDepreciationAccountId("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create asset category");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/assets/categories/export");
    downloadCsv(csv, "asset-categories.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Assets</h1>
        <p className="text-sm text-muted-foreground">
          Fixed asset register, straight-line depreciation, and disposals.
        </p>
      </div>

      <AssetsSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Search categories…"
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
              New category
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input placeholder="Code (e.g. COMP)" value={code} onChange={(e) => setCode(e.target.value)} required />
              <Input
                type="number"
                min={1}
                placeholder="Useful life (months)"
                value={usefulLife}
                onChange={(e) => setUsefulLife(e.target.value)}
              />
              <select
                value={assetAccountId}
                onChange={(e) => setAssetAccountId(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">Asset account…</option>
                {ledgerAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
              <select
                value={depreciationExpenseAccountId}
                onChange={(e) => setDepreciationExpenseAccountId(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">Depreciation expense account…</option>
                {ledgerAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
              <select
                value={accumulatedDepreciationAccountId}
                onChange={(e) => setAccumulatedDepreciationAccountId(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">Accumulated depreciation account…</option>
                {ledgerAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
              <Button type="submit" disabled={submitting} className="sm:col-start-3">
                {submitting ? "Creating…" : "Create category"}
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
                <th className="p-3 font-medium">Useful life</th>
                <th className="p-3 font-medium">Asset account</th>
                <th className="p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {result === null ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : result.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-muted-foreground">
                    No asset categories yet.
                  </td>
                </tr>
              ) : (
                result.items.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">{c.code}</td>
                    <td className="p-3 text-muted-foreground">{c.name}</td>
                    <td className="p-3 text-muted-foreground">{c.defaultUsefulLifeMonths} mo</td>
                    <td className="p-3 text-muted-foreground">
                      {c.assetAccount ? `${c.assetAccount.code} — ${c.assetAccount.name}` : "—"}
                    </td>
                    <td className="p-3">
                      <Badge variant={c.isActive ? "default" : "outline"}>{c.isActive ? "Active" : "Inactive"}</Badge>
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
