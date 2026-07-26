"use client";

import { Fragment, useEffect, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv, formatCents } from "../../../../lib/format";
import type { Employee, ExpenseCategory, ExpenseClaim, LedgerAccount, Paginated } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { ExpensesSubnav } from "../../../../components/expenses/expenses-subnav";

interface DraftLine {
  categoryId: string;
  description: string;
  amount: string;
}

const EMPTY_LINE: DraftLine = { categoryId: "", description: "", amount: "" };

export default function ExpenseClaimsPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.EXPENSES_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<ExpenseClaim> | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [statusFilter, setStatusFilter] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ ...EMPTY_LINE }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [creditAccountId, setCreditAccountId] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const load = () => {
    const qs = new URLSearchParams({ page: "1", pageSize: "50" });
    if (statusFilter) qs.set("status", statusFilter);
    void apiClient.get<Paginated<ExpenseClaim>>(`/expenses/claims?${qs}`).then(setResult);
  };

  useEffect(load, [statusFilter]);
  useEffect(() => {
    void apiClient.get<Paginated<Employee>>("/hr/employees?page=1&pageSize=100").then((r) => setEmployees(r.items));
    void apiClient
      .get<Paginated<ExpenseCategory>>("/expenses/categories?page=1&pageSize=100&isActive=true")
      .then((r) => setCategories(r.items));
    void apiClient
      .get<Paginated<LedgerAccount>>("/accounting/ledger-accounts?page=1&pageSize=100")
      .then((r) => setLedgerAccounts(r.items));
  }, []);

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/expenses/claims", {
        employeeId,
        expenseDate,
        items: lines.map((l) => ({
          categoryId: l.categoryId,
          description: l.description,
          amountCents: Math.round(parseFloat(l.amount || "0") * 100),
        })),
      });
      setEmployeeId("");
      setExpenseDate("");
      setLines([{ ...EMPTY_LINE }]);
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create expense claim");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(id: string, action: "submit" | "cancel" | "mark-paid") {
    setActionError(null);
    try {
      await apiClient.post(`/expenses/claims/${id}/${action}`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : `Failed to ${action.replace("-", " ")} claim`);
    }
  }

  async function handleApprove(id: string) {
    setActionError(null);
    try {
      await apiClient.post(`/expenses/claims/${id}/approve`, { creditAccountId });
      setApprovingId(null);
      setCreditAccountId("");
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to approve claim");
    }
  }

  async function handleReject(id: string) {
    setActionError(null);
    try {
      await apiClient.post(`/expenses/claims/${id}/reject`, { rejectionReason });
      setRejectingId(null);
      setRejectionReason("");
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to reject claim");
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/expenses/claims/export");
    downloadCsv(csv, "expense-claims.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Expenses</h1>
        <p className="text-sm text-muted-foreground">Expense categories and employee expense claims.</p>
      </div>

      <ExpensesSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="PAID">Paid</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
          {canWrite && (
            <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New claim
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                  required
                >
                  <option value="">Select employee…</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employeeNumber} — {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </select>
                <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
              </div>

              <div className="flex flex-col gap-2">
                {lines.map((line, index) => (
                  <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_3fr_1fr_auto]">
                    <select
                      value={line.categoryId}
                      onChange={(e) => updateLine(index, { categoryId: e.target.value })}
                      className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                      required
                    >
                      <option value="">Category…</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    <Input
                      placeholder="Description"
                      value={line.description}
                      onChange={(e) => updateLine(index, { description: e.target.value })}
                      required
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Amount"
                      value={line.amount}
                      onChange={(e) => updateLine(index, { amount: e.target.value })}
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={lines.length === 1}
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => setLines((prev) => [...prev, { ...EMPTY_LINE }])}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add line
                </Button>
              </div>

              <Button type="submit" disabled={submitting} className="self-start">
                {submitting ? "Creating…" : "Create draft claim"}
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
                <th className="p-3 font-medium">Claim #</th>
                <th className="p-3 font-medium">Employee</th>
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Total</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium" />
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
                    No expense claims yet.
                  </td>
                </tr>
              ) : (
                result.items.map((claim) => (
                  <Fragment key={claim.id}>
                    <tr
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                      onClick={() => setExpandedId(expandedId === claim.id ? null : claim.id)}
                    >
                      <td className="p-3 font-medium text-foreground">{claim.claimNumber}</td>
                      <td className="p-3 text-muted-foreground">
                        {claim.employee.firstName} {claim.employee.lastName}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(claim.expenseDate).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-muted-foreground">{formatCents(claim.totalCents, claim.currency)}</td>
                      <td className="p-3">
                        <Badge variant={claim.status === "PAID" ? "default" : "outline"}>{claim.status}</Badge>
                      </td>
                      <td className="p-3 text-right">
                        {canWrite && (
                          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            {claim.status === "DRAFT" && (
                              <>
                                <Button type="button" size="sm" onClick={() => handleAction(claim.id, "submit")}>
                                  Submit
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAction(claim.id, "cancel")}
                                >
                                  Cancel
                                </Button>
                              </>
                            )}
                            {claim.status === "SUBMITTED" && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => {
                                    setApprovingId(claim.id);
                                    setRejectingId(null);
                                  }}
                                >
                                  Approve
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setRejectingId(claim.id);
                                    setApprovingId(null);
                                  }}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            {claim.status === "APPROVED" && (
                              <Button type="button" size="sm" onClick={() => handleAction(claim.id, "mark-paid")}>
                                Mark paid
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>

                    {approvingId === claim.id && (
                      <tr className="border-b border-border bg-muted/30">
                        <td colSpan={6} className="p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted-foreground">Credit (payable) account:</span>
                            <select
                              value={creditAccountId}
                              onChange={(e) => setCreditAccountId(e.target.value)}
                              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                            >
                              <option value="">Select account…</option>
                              {ledgerAccounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.code} — {a.name}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              size="sm"
                              disabled={!creditAccountId}
                              onClick={() => handleApprove(claim.id)}
                            >
                              Confirm approve
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setApprovingId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {rejectingId === claim.id && (
                      <tr className="border-b border-border bg-muted/30">
                        <td colSpan={6} className="p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              placeholder="Reason for rejection"
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              className="max-w-sm"
                            />
                            <Button
                              type="button"
                              size="sm"
                              disabled={!rejectionReason}
                              onClick={() => handleReject(claim.id)}
                            >
                              Confirm reject
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setRejectingId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {expandedId === claim.id && (
                      <tr className="border-b border-border bg-muted/30">
                        <td colSpan={6} className="p-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-muted-foreground">
                                <th className="pb-1 pr-4">Category</th>
                                <th className="pb-1 pr-4">Description</th>
                                <th className="pb-1">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {claim.items.map((line, i) => (
                                <tr key={i}>
                                  <td className="py-1 pr-4">{line.categoryName}</td>
                                  <td className="py-1 pr-4">{line.description}</td>
                                  <td className="py-1">{formatCents(line.amountCents, claim.currency)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {claim.rejectionReason && (
                            <p className="mt-2 text-xs text-red-600">Rejected: {claim.rejectionReason}</p>
                          )}
                          {claim.journalEntry && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Posted as journal entry {claim.journalEntry.entryNumber}
                            </p>
                          )}
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
