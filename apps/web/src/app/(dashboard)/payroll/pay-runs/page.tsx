"use client";

import { Fragment, useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv, formatCents } from "../../../../lib/format";
import type { Paginated, PayRun, Payslip } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { PayrollSubnav } from "../../../../components/payroll/payroll-subnav";

export default function PayRunsPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.PAYROLL_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<PayRun> | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payslipsByRun, setPayslipsByRun] = useState<Record<string, Payslip[]>>({});

  const load = () => {
    void apiClient.get<Paginated<PayRun>>("/payroll/pay-runs?page=1&pageSize=50").then(setResult);
  };

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/payroll/pay-runs", { periodStart, periodEnd, paymentDate: paymentDate || undefined });
      setPeriodStart("");
      setPeriodEnd("");
      setPaymentDate("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create pay run");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(id: string, action: "generate" | "mark-paid" | "cancel") {
    setActionError(null);
    try {
      await apiClient.post(`/payroll/pay-runs/${id}/${action}`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : `Failed to ${action.replace("-", " ")} pay run`);
    }
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!payslipsByRun[id]) {
      const r = await apiClient.get<Paginated<Payslip>>(`/payroll/payslips?payRunId=${id}&pageSize=100`);
      setPayslipsByRun((prev) => ({ ...prev, [id]: r.items }));
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/payroll/pay-runs/export");
    downloadCsv(csv, "pay-runs.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Payroll</h1>
        <p className="text-sm text-muted-foreground">Salary components, pay runs, and payslips.</p>
      </div>

      <PayrollSubnav />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-1 h-3.5 w-3.5" />
          Export CSV
        </Button>
        {canWrite && (
          <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New pay run
          </Button>
        )}
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required />
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
              <Input
                type="date"
                placeholder="Payment date (optional)"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
              <Button type="submit" disabled={submitting} className="sm:col-start-4">
                {submitting ? "Creating…" : "Create draft pay run"}
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
                <th className="p-3 font-medium">Period</th>
                <th className="p-3 font-medium">Payment date</th>
                <th className="p-3 font-medium">Payslips</th>
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
                    No pay runs yet.
                  </td>
                </tr>
              ) : (
                result.items.map((pr) => (
                  <Fragment key={pr.id}>
                    <tr
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                      onClick={() => toggleExpand(pr.id)}
                    >
                      <td className="p-3 font-medium text-foreground">
                        {new Date(pr.periodStart).toLocaleDateString()} – {new Date(pr.periodEnd).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {pr.paymentDate ? new Date(pr.paymentDate).toLocaleDateString() : "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">{pr.payslipCount}</td>
                      <td className="p-3">
                        <Badge variant={pr.status === "PAID" ? "default" : "outline"}>{pr.status}</Badge>
                      </td>
                      <td className="p-3 text-right">
                        {canWrite && (
                          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            {pr.status === "DRAFT" && (
                              <>
                                <Button type="button" size="sm" onClick={() => handleAction(pr.id, "generate")}>
                                  Generate
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAction(pr.id, "cancel")}
                                >
                                  Cancel
                                </Button>
                              </>
                            )}
                            {pr.status === "PROCESSED" && (
                              <>
                                <Button type="button" size="sm" onClick={() => handleAction(pr.id, "mark-paid")}>
                                  Mark paid
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAction(pr.id, "cancel")}
                                >
                                  Cancel
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                    {expandedId === pr.id && (
                      <tr className="border-b border-border bg-muted/30">
                        <td colSpan={5} className="p-3">
                          {(() => {
                            const payslips = payslipsByRun[pr.id];
                            if (!payslips) {
                              return <p className="text-xs text-muted-foreground">Loading payslips…</p>;
                            }
                            if (payslips.length === 0) {
                              return <p className="text-xs text-muted-foreground">No payslips generated yet.</p>;
                            }
                            return (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-muted-foreground">
                                  <th className="pb-1 pr-4">Employee</th>
                                  <th className="pb-1 pr-4">Basic</th>
                                  <th className="pb-1 pr-4">Gross</th>
                                  <th className="pb-1 pr-4">Deductions</th>
                                  <th className="pb-1 pr-4">Net</th>
                                  <th className="pb-1">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {payslips.map((p) => (
                                  <tr key={p.id}>
                                    <td className="py-1 pr-4">
                                      {p.employee.firstName} {p.employee.lastName}
                                    </td>
                                    <td className="py-1 pr-4">{formatCents(p.basicSalaryCents, p.currency)}</td>
                                    <td className="py-1 pr-4">{formatCents(p.grossPayCents, p.currency)}</td>
                                    <td className="py-1 pr-4">{formatCents(p.deductionsCents, p.currency)}</td>
                                    <td className="py-1 pr-4 font-medium text-foreground">
                                      {formatCents(p.netPayCents, p.currency)}
                                    </td>
                                    <td className="py-1">{p.status}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            );
                          })()}
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
