"use client";

import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Button, Card, CardContent, Input } from "@omniflow/ui";
import { apiClient } from "../../../../lib/api-client";
import { downloadCsv, formatCents } from "../../../../lib/format";
import type { CrmAccount, CrmDeal, CrmDealStage, Paginated } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { CrmSubnav } from "../../../../components/crm/crm-subnav";

const STAGES: CrmDealStage[] = ["PROSPECTING", "QUALIFICATION", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];

export default function CrmDealsPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.CRM_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<CrmDeal> | null>(null);
  const [accounts, setAccounts] = useState<CrmAccount[]>([]);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [valueDollars, setValueDollars] = useState("");
  const [accountId, setAccountId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    const qs = new URLSearchParams({ page: "1", pageSize: "50" });
    if (search) qs.set("search", search);
    if (stage) qs.set("stage", stage);
    void apiClient.get<Paginated<CrmDeal>>(`/crm/deals?${qs}`).then(setResult);
  };

  useEffect(load, [search, stage]);
  useEffect(() => {
    void apiClient
      .get<Paginated<CrmAccount>>("/crm/accounts?page=1&pageSize=100")
      .then((r) => setAccounts(r.items));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.post("/crm/deals", {
        title,
        valueCents: Math.round(parseFloat(valueDollars || "0") * 100),
        accountId: accountId || undefined,
      });
      setTitle("");
      setValueDollars("");
      setAccountId("");
      setShowCreate(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStageChange(id: string, newStage: string) {
    await apiClient.patch(`/crm/deals/${id}`, { stage: newStage });
    load();
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/crm/deals/export");
    downloadCsv(csv, "crm-deals.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">CRM</h1>
        <p className="text-sm text-muted-foreground">Accounts, contacts, leads, and the sales pipeline.</p>
      </div>

      <CrmSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search deals…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">All stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
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
              New deal
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <Input
                placeholder="Value (USD)"
                type="number"
                min="0"
                step="0.01"
                value={valueDollars}
                onChange={(e) => setValueDollars(e.target.value)}
              />
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
              <Button type="submit" disabled={submitting} className="sm:col-start-4">
                {submitting ? "Creating…" : "Create deal"}
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
                <th className="p-3 font-medium">Title</th>
                <th className="p-3 font-medium">Account</th>
                <th className="p-3 font-medium">Value</th>
                <th className="p-3 font-medium">Stage</th>
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
                    No deals yet.
                  </td>
                </tr>
              ) : (
                result.items.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">{d.title}</td>
                    <td className="p-3 text-muted-foreground">{d.account?.name ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{formatCents(d.valueCents, d.currency)}</td>
                    <td className="p-3">
                      {canWrite ? (
                        <select
                          value={d.stage}
                          onChange={(e) => handleStageChange(d.id, e.target.value)}
                          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                        >
                          {STAGES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        d.stage
                      )}
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
