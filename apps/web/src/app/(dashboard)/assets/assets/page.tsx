"use client";

import { Fragment, useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv, formatCents } from "../../../../lib/format";
import type { Asset, AssetCategory, LedgerAccount, Paginated } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { AssetsSubnav } from "../../../../components/assets/assets-subnav";

export default function AssetsListPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.ASSETS_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<Asset> | null>(null);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [statusFilter, setStatusFilter] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaseCost, setPurchaseCost] = useState("");
  const [salvageValue, setSalvageValue] = useState("");
  const [usefulLifeMonths, setUsefulLifeMonths] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [disposingId, setDisposingId] = useState<string | null>(null);
  const [disposalDate, setDisposalDate] = useState("");
  const [disposalProceeds, setDisposalProceeds] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");
  const [gainLossAccountId, setGainLossAccountId] = useState("");

  const load = () => {
    const qs = new URLSearchParams({ page: "1", pageSize: "50" });
    if (statusFilter) qs.set("status", statusFilter);
    void apiClient.get<Paginated<Asset>>(`/assets/assets?${qs}`).then(setResult);
  };

  useEffect(load, [statusFilter]);
  useEffect(() => {
    void apiClient
      .get<Paginated<AssetCategory>>("/assets/categories?page=1&pageSize=100&isActive=true")
      .then((r) => setCategories(r.items));
    void apiClient
      .get<Paginated<LedgerAccount>>("/accounting/ledger-accounts?page=1&pageSize=100")
      .then((r) => setLedgerAccounts(r.items));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/assets/assets", {
        categoryId,
        name,
        purchaseDate,
        purchaseCostCents: Math.round(parseFloat(purchaseCost || "0") * 100),
        salvageValueCents: salvageValue ? Math.round(parseFloat(salvageValue) * 100) : undefined,
        usefulLifeMonths: usefulLifeMonths ? parseInt(usefulLifeMonths, 10) : undefined,
      });
      setCategoryId("");
      setName("");
      setPurchaseDate("");
      setPurchaseCost("");
      setSalvageValue("");
      setUsefulLifeMonths("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to register asset");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDispose(id: string) {
    setActionError(null);
    try {
      await apiClient.post(`/assets/assets/${id}/dispose`, {
        disposalDate,
        disposalProceedsCents: disposalProceeds ? Math.round(parseFloat(disposalProceeds) * 100) : undefined,
        cashAccountId: cashAccountId || undefined,
        gainLossAccountId,
      });
      setDisposingId(null);
      setDisposalDate("");
      setDisposalProceeds("");
      setCashAccountId("");
      setGainLossAccountId("");
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to dispose of asset");
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/assets/assets/export");
    downloadCsv(csv, "assets.csv");
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DISPOSED">Disposed</option>
        </select>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
          {canWrite && (
            <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Register asset
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                required
              >
                <option value="">Category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} required />
              <Input
                type="number"
                step="0.01"
                placeholder="Purchase cost"
                value={purchaseCost}
                onChange={(e) => setPurchaseCost(e.target.value)}
                required
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Salvage value (optional)"
                value={salvageValue}
                onChange={(e) => setSalvageValue(e.target.value)}
              />
              <Input
                type="number"
                min={1}
                placeholder="Useful life months (optional)"
                value={usefulLifeMonths}
                onChange={(e) => setUsefulLifeMonths(e.target.value)}
              />
              <Button type="submit" disabled={submitting} className="sm:col-start-3">
                {submitting ? "Registering…" : "Register asset"}
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
                <th className="p-3 font-medium">Asset #</th>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Category</th>
                <th className="p-3 font-medium">Cost</th>
                <th className="p-3 font-medium">Accum. dep.</th>
                <th className="p-3 font-medium">Net book value</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {result === null ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : result.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-muted-foreground">
                    No assets registered yet.
                  </td>
                </tr>
              ) : (
                result.items.map((a) => (
                  <Fragment key={a.id}>
                    <tr className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="p-3 font-medium text-foreground">{a.assetNumber}</td>
                      <td className="p-3 text-muted-foreground">{a.name}</td>
                      <td className="p-3 text-muted-foreground">{a.category.name}</td>
                      <td className="p-3 text-muted-foreground">{formatCents(a.purchaseCostCents, a.currency)}</td>
                      <td className="p-3 text-muted-foreground">
                        {formatCents(a.accumulatedDepreciationCents, a.currency)}
                      </td>
                      <td className="p-3 font-medium text-foreground">
                        {formatCents(a.purchaseCostCents - a.accumulatedDepreciationCents, a.currency)}
                      </td>
                      <td className="p-3">
                        <Badge variant={a.status === "ACTIVE" ? "default" : "outline"}>{a.status}</Badge>
                      </td>
                      <td className="p-3 text-right">
                        {canWrite && a.status === "ACTIVE" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setDisposingId(disposingId === a.id ? null : a.id);
                              setActionError(null);
                            }}
                          >
                            Dispose
                          </Button>
                        )}
                      </td>
                    </tr>
                    {disposingId === a.id && (
                      <tr className="border-b border-border bg-muted/30">
                        <td colSpan={8} className="p-3">
                          <div className="flex flex-wrap items-end gap-2">
                            <Input
                              type="date"
                              value={disposalDate}
                              onChange={(e) => setDisposalDate(e.target.value)}
                              className="w-40"
                            />
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Proceeds"
                              value={disposalProceeds}
                              onChange={(e) => setDisposalProceeds(e.target.value)}
                              className="w-32"
                            />
                            <select
                              value={cashAccountId}
                              onChange={(e) => setCashAccountId(e.target.value)}
                              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                            >
                              <option value="">Cash account (if proceeds)…</option>
                              {ledgerAccounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.code} — {acc.name}
                                </option>
                              ))}
                            </select>
                            <select
                              value={gainLossAccountId}
                              onChange={(e) => setGainLossAccountId(e.target.value)}
                              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                            >
                              <option value="">Gain/loss account…</option>
                              {ledgerAccounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.code} — {acc.name}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              size="sm"
                              disabled={!disposalDate || !gainLossAccountId}
                              onClick={() => handleDispose(a.id)}
                            >
                              Confirm dispose
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setDisposingId(null)}>
                              Cancel
                            </Button>
                          </div>
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
