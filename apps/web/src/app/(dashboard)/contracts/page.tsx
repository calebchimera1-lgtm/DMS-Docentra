"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Banknote, Download, FileClock, FileText, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Pagination } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../lib/api-client";
import { downloadCsv, formatCents } from "../../../lib/format";
import type { Contract, ContractsByStatus, ContractsSummary, ContractType, CrmAccount, Paginated } from "../../../lib/types";
import { useAuth } from "../../../providers/auth-provider";
import { StageBarChart } from "../../../components/crm/stage-bar-chart";
import { StatTile } from "../../../components/stat-tile";

const CONTRACT_TYPES: ContractType[] = ["SALES", "PURCHASE", "SERVICE", "EMPLOYMENT", "NDA", "OTHER"];

export default function ContractsPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.CONTRACTS_WRITE) ?? false;

  const [summary, setSummary] = useState<ContractsSummary | null>(null);
  const [byStatus, setByStatus] = useState<ContractsByStatus[] | null>(null);
  const [result, setResult] = useState<Paginated<Contract> | null>(null);
  const [accounts, setAccounts] = useState<CrmAccount[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ContractType>("SERVICE");
  const [accountId, setAccountId] = useState("");
  const [valueCents, setValueCents] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [autoRenew, setAutoRenew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const qs = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (search) qs.set("search", search);
    if (statusFilter) qs.set("status", statusFilter);
    void apiClient.get<Paginated<Contract>>(`/contracts?${qs}`).then(setResult);
    void apiClient.get<ContractsSummary>("/contracts/reports/summary").then(setSummary);
    void apiClient.get<ContractsByStatus[]>("/contracts/reports/by-status").then(setByStatus);
  };

  useEffect(load, [search, statusFilter, page]);
  useEffect(() => setPage(1), [search, statusFilter]);
  useEffect(() => {
    void apiClient.get<Paginated<CrmAccount>>("/crm/accounts?page=1&pageSize=100").then((r) => setAccounts(r.items));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/contracts", {
        title,
        type,
        accountId: accountId || undefined,
        valueCents: valueCents ? Math.round(parseFloat(valueCents) * 100) : undefined,
        startDate,
        endDate,
        autoRenew,
      });
      setTitle("");
      setType("SERVICE");
      setAccountId("");
      setValueCents("");
      setStartDate("");
      setEndDate("");
      setAutoRenew(false);
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create contract");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/contracts/export");
    downloadCsv(csv, "contracts.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Contracts</h1>
        <p className="text-sm text-muted-foreground">Contract lifecycle, from draft through renewal.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Draft" value={summary?.draftCount ?? "—"} icon={FileClock} />
        <StatTile label="Active" value={summary?.activeCount ?? "—"} icon={FileText} />
        <StatTile label="Expiring within 30 days" value={summary?.expiringSoonCount ?? "—"} icon={AlertTriangle} />
        <StatTile
          label="Total active value"
          value={summary ? formatCents(summary.totalActiveValueCents) : "—"}
          icon={Banknote}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contracts by status</CardTitle>
        </CardHeader>
        <CardContent>
          {byStatus ? (
            <StageBarChart
              ariaLabel="Contract count by status"
              data={byStatus.map((s) => ({ label: s.status, value: s.count, displayValue: String(s.count) }))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Search contracts…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="TERMINATED">Terminated</option>
            <option value="RENEWED">Renewed</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
          {canWrite && (
            <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New contract
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ContractType)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                {CONTRACT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">No account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                step="0.01"
                placeholder="Value (optional)"
                value={valueCents}
                onChange={(e) => setValueCents(e.target.value)}
              />
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
                Auto-renew
              </label>
              <Button type="submit" disabled={submitting} className="sm:col-start-3">
                {submitting ? "Creating…" : "Create contract"}
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
                <th className="p-3 font-medium">Number</th>
                <th className="p-3 font-medium">Title</th>
                <th className="p-3 font-medium">Account</th>
                <th className="p-3 font-medium">Value</th>
                <th className="p-3 font-medium">End date</th>
                <th className="p-3 font-medium">Status</th>
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
                    No contracts yet.
                  </td>
                </tr>
              ) : (
                result.items.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">
                      <Link href={`/contracts/${c.id}`} className="hover:underline">
                        {c.contractNumber}
                      </Link>
                    </td>
                    <td className="p-3 text-muted-foreground">{c.title}</td>
                    <td className="p-3 text-muted-foreground">{c.account?.name ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{formatCents(c.valueCents, c.currency)}</td>
                    <td className="p-3 text-muted-foreground">{new Date(c.endDate).toLocaleDateString()}</td>
                    <td className="p-3">
                      <Badge variant={c.status === "ACTIVE" ? "default" : "outline"}>{c.status}</Badge>
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
