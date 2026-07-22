"use client";

import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input } from "@omniflow/ui";
import { apiClient } from "../../../../lib/api-client";
import { downloadCsv, formatCents } from "../../../../lib/format";
import type { CrmAccount, Paginated, Quote, QuoteStatus } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import {
  DraftLineItem,
  LineItemsEditor,
  emptyLineItem,
  toLineItemPayload,
} from "../../../../components/sales/line-items-editor";
import { SalesSubnav } from "../../../../components/sales/sales-subnav";

const STATUSES: QuoteStatus[] = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"];

export default function QuotesPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.SALES_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<Quote> | null>(null);
  const [accounts, setAccounts] = useState<CrmAccount[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [lineItems, setLineItems] = useState<DraftLineItem[]>([emptyLineItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const qs = new URLSearchParams({ page: "1", pageSize: "50" });
    if (search) qs.set("search", search);
    if (status) qs.set("status", status);
    void apiClient.get<Paginated<Quote>>(`/sales/quotes?${qs}`).then(setResult);
  };

  useEffect(load, [search, status]);
  useEffect(() => {
    void apiClient
      .get<Paginated<CrmAccount>>("/crm/accounts?page=1&pageSize=100")
      .then((r) => setAccounts(r.items));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const items = toLineItemPayload(lineItems);
      if (items.length === 0) {
        setError("Add at least one line item");
        return;
      }
      await apiClient.post("/sales/quotes", { accountId, items });
      setAccountId("");
      setLineItems([emptyLineItem()]);
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quote");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    await apiClient.patch(`/sales/quotes/${id}`, { status: newStatus });
    load();
  }

  async function handleConvert(id: string) {
    await apiClient.post(`/sales/quotes/${id}/convert-to-order`);
    load();
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/sales/quotes/export");
    downloadCsv(csv, "quotes.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Sales</h1>
        <p className="text-sm text-muted-foreground">Products, quotes, sales orders, and invoices.</p>
      </div>

      <SalesSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search quotes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
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
              New quote
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="h-10 max-w-sm rounded-md border border-border bg-background px-3 text-sm"
                required
              >
                <option value="">Select an account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <LineItemsEditor items={lineItems} onChange={setLineItems} />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={submitting || !accountId} className="self-start">
                {submitting ? "Creating…" : "Create quote"}
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
                <th className="p-3 font-medium">Quote #</th>
                <th className="p-3 font-medium">Account</th>
                <th className="p-3 font-medium">Total</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium" />
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
                    No quotes yet.
                  </td>
                </tr>
              ) : (
                result.items.map((q) => (
                  <tr key={q.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">{q.quoteNumber}</td>
                    <td className="p-3 text-muted-foreground">{q.account?.name ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{formatCents(q.totalCents, q.currency)}</td>
                    <td className="p-3">
                      {canWrite && q.status !== "ACCEPTED" ? (
                        <select
                          value={q.status}
                          onChange={(e) => handleStatusChange(q.id, e.target.value)}
                          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Badge variant="outline">{q.status}</Badge>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {canWrite && q.status === "ACCEPTED" && !q.salesOrder && (
                        <Button type="button" size="sm" variant="outline" onClick={() => handleConvert(q.id)}>
                          Convert to order
                        </Button>
                      )}
                      {q.salesOrder && (
                        <span className="text-xs text-muted-foreground">{q.salesOrder.orderNumber}</span>
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
