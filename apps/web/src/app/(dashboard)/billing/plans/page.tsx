"use client";

import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input, Pagination } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv, formatCents } from "../../../../lib/format";
import type { BillingInterval, Paginated, SubscriptionPlan } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { BillingSubnav } from "../../../../components/billing/billing-subnav";

export default function BillingPlansPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.BILLING_WRITE) ?? false;
  const canDelete = user?.effectivePermissions.includes(PERMISSIONS.BILLING_DELETE) ?? false;

  const [result, setResult] = useState<Paginated<SubscriptionPlan> | null>(null);
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [priceCents, setPriceCents] = useState("");
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("MONTHLY");
  const [trialDays, setTrialDays] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = () => {
    void apiClient.get<Paginated<SubscriptionPlan>>(`/billing/plans?page=${page}&pageSize=50`).then(setResult);
  };

  useEffect(load, [page]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/billing/plans", {
        code,
        name,
        priceCents: Math.max(0, parseInt(priceCents, 10) || 0),
        billingInterval,
        trialDays: Math.max(0, parseInt(trialDays, 10) || 0),
      });
      setCode("");
      setName("");
      setPriceCents("");
      setBillingInterval("MONTHLY");
      setTrialDays("0");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create plan");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(plan: SubscriptionPlan) {
    setActionError(null);
    try {
      await apiClient.patch(`/billing/plans/${plan.id}`, { isActive: !plan.isActive });
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update plan");
    }
  }

  async function handleDelete(id: string) {
    setActionError(null);
    try {
      await apiClient.delete(`/billing/plans/${id}`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete plan");
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/billing/plans/export");
    downloadCsv(csv, "subscription-plans.csv");
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

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-1 h-3.5 w-3.5" />
          Export CSV
        </Button>
        {canWrite && (
          <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New plan
          </Button>
        )}
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-5">
              <Input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} required />
              <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input
                type="number"
                min="0"
                placeholder="Price (cents)"
                value={priceCents}
                onChange={(e) => setPriceCents(e.target.value)}
                required
              />
              <select
                value={billingInterval}
                onChange={(e) => setBillingInterval(e.target.value as BillingInterval)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="YEARLY">Yearly</option>
              </select>
              <Input
                type="number"
                min="0"
                placeholder="Trial days"
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
              />
              <Button type="submit" disabled={submitting} className="sm:col-start-5">
                {submitting ? "Creating…" : "Create plan"}
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
                <th className="p-3 font-medium">Code</th>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Price</th>
                <th className="p-3 font-medium">Interval</th>
                <th className="p-3 font-medium">Trial</th>
                <th className="p-3 font-medium">Subscriptions</th>
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
                    No plans yet.
                  </td>
                </tr>
              ) : (
                result.items.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">{p.code}</td>
                    <td className="p-3 text-muted-foreground">{p.name}</td>
                    <td className="p-3 text-muted-foreground">{formatCents(p.priceCents, p.currency)}</td>
                    <td className="p-3 text-muted-foreground">{p.billingInterval}</td>
                    <td className="p-3 text-muted-foreground">{p.trialDays > 0 ? `${p.trialDays}d` : "—"}</td>
                    <td className="p-3 text-muted-foreground">{p._count.subscriptions}</td>
                    <td className="p-3">
                      <Badge variant={p.isActive ? "default" : "outline"}>{p.isActive ? "Active" : "Inactive"}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        {canWrite && (
                          <Button type="button" size="sm" variant="outline" onClick={() => handleToggleActive(p)}>
                            {p.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        )}
                        {canDelete && p._count.subscriptions === 0 && (
                          <Button type="button" size="sm" variant="destructive" onClick={() => handleDelete(p.id)}>
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
