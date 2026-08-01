"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input, Pagination } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv, formatCents } from "../../../../lib/format";
import type {
  CrmAccount,
  Paginated,
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { BillingSubnav } from "../../../../components/billing/billing-subnav";

export default function SubscriptionsPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.BILLING_WRITE) ?? false;
  const canDelete = user?.effectivePermissions.includes(PERMISSIONS.BILLING_DELETE) ?? false;

  const [result, setResult] = useState<Paginated<Subscription> | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [accounts, setAccounts] = useState<CrmAccount[]>([]);
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | "">("");
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [planId, setPlanId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = () => {
    const qs = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (statusFilter) qs.set("status", statusFilter);
    void apiClient.get<Paginated<Subscription>>(`/billing/subscriptions?${qs}`).then(setResult);
  };

  useEffect(load, [statusFilter, page]);
  useEffect(() => setPage(1), [statusFilter]);
  useEffect(() => {
    void apiClient
      .get<Paginated<SubscriptionPlan>>("/billing/plans?page=1&pageSize=100&isActive=true")
      .then((r) => setPlans(r.items));
    void apiClient.get<Paginated<CrmAccount>>("/crm/accounts?page=1&pageSize=100").then((r) => setAccounts(r.items));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/billing/subscriptions", {
        accountId,
        planId,
        quantity: Math.max(1, parseInt(quantity, 10) || 1),
      });
      setAccountId("");
      setPlanId("");
      setQuantity("1");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create subscription");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(id: string, action: "activate" | "bill" | "pause" | "resume" | "cancel") {
    setActionError(null);
    try {
      await apiClient.post(`/billing/subscriptions/${id}/${action}`, {});
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : `Failed to ${action} subscription`);
    }
  }

  async function handleDelete(id: string) {
    setActionError(null);
    try {
      await apiClient.delete(`/billing/subscriptions/${id}`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete subscription");
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/billing/subscriptions/export");
    downloadCsv(csv, "subscriptions.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Subscription Billing</h1>
        <p className="text-sm text-muted-foreground">
          Recurring plans, subscriptions, and the invoices they generate.
        </p>
      </div>

      <BillingSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SubscriptionStatus | "")}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="TRIALING">Trialing</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="EXPIRED">Expired</option>
        </select>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
          {canWrite && (
            <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New subscription
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                required
              >
                <option value="">Customer account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                required
              >
                <option value="">Plan…</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {formatCents(p.priceCents, p.currency)}/{p.billingInterval.toLowerCase()}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min="1"
                placeholder="Quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create subscription"}
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
                <th className="p-3 font-medium">Account</th>
                <th className="p-3 font-medium">Plan</th>
                <th className="p-3 font-medium">Qty</th>
                <th className="p-3 font-medium">Current period</th>
                <th className="p-3 font-medium">Invoices</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {result === null ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : result.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">
                    No subscriptions yet.
                  </td>
                </tr>
              ) : (
                result.items.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">
                      <Link href={`/billing/subscriptions/${s.id}`} className="hover:underline">
                        {s.account.name}
                      </Link>
                    </td>
                    <td className="p-3 text-muted-foreground">{s.plan.code}</td>
                    <td className="p-3 text-muted-foreground">{s.quantity}</td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(s.currentPeriodStart).toLocaleDateString()} –{" "}
                      {new Date(s.currentPeriodEnd).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-muted-foreground">{s.invoices.length}</td>
                    <td className="p-3">
                      <Badge variant={s.status === "ACTIVE" ? "default" : "outline"}>{s.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        {canWrite && s.status === "TRIALING" && (
                          <Button type="button" size="sm" onClick={() => handleAction(s.id, "activate")}>
                            Activate
                          </Button>
                        )}
                        {canWrite && s.status === "ACTIVE" && (
                          <>
                            <Button type="button" size="sm" onClick={() => handleAction(s.id, "bill")}>
                              Bill period
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => handleAction(s.id, "pause")}>
                              Pause
                            </Button>
                          </>
                        )}
                        {canWrite && s.status === "PAUSED" && (
                          <Button type="button" size="sm" onClick={() => handleAction(s.id, "resume")}>
                            Resume
                          </Button>
                        )}
                        {canWrite && s.status !== "CANCELLED" && (
                          <Button type="button" size="sm" variant="outline" onClick={() => handleAction(s.id, "cancel")}>
                            Cancel
                          </Button>
                        )}
                        {canDelete && s.invoices.length === 0 && (
                          <Button type="button" size="sm" variant="destructive" onClick={() => handleDelete(s.id)}>
                            Delete
                          </Button>
                        )}
                      </div>
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
