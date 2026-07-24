"use client";

import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Button, Card, CardContent, Input } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv, formatCents } from "../../../../lib/format";
import type { Invoice, LedgerAccount, Paginated, Payment } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { AccountingSubnav } from "../../../../components/accounting/accounting-subnav";

export default function PaymentsPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.ACCOUNTING_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<Payment> | null>(null);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  const [amountDollars, setAmountDollars] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [debitAccountId, setDebitAccountId] = useState("");
  const [creditAccountId, setCreditAccountId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    void apiClient.get<Paginated<Payment>>("/accounting/payments?page=1&pageSize=50").then(setResult);
  };

  useEffect(load, []);
  useEffect(() => {
    void apiClient
      .get<Paginated<LedgerAccount>>("/accounting/ledger-accounts?page=1&pageSize=100")
      .then((r) => setLedgerAccounts(r.items));
    void apiClient
      .get<Paginated<Invoice>>("/sales/invoices?page=1&pageSize=100")
      .then((r) => setUnpaidInvoices(r.items.filter((inv) => inv.status !== "PAID" && inv.status !== "CANCELLED")));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/accounting/payments", {
        amountCents: Math.round(parseFloat(amountDollars || "0") * 100),
        paymentDate,
        debitAccountId,
        creditAccountId,
        invoiceId: invoiceId || undefined,
        reference: reference || undefined,
      });
      setAmountDollars("");
      setReference("");
      setInvoiceId("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/accounting/payments/export");
    downloadCsv(csv, "payments.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Accounting</h1>
        <p className="text-sm text-muted-foreground">Chart of accounts, journal entries, and payments.</p>
      </div>

      <AccountingSubnav />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-1 h-3.5 w-3.5" />
          Export CSV
        </Button>
        {canWrite && (
          <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New payment
          </Button>
        )}
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                placeholder="Amount (USD)"
                type="number"
                min="0"
                step="0.01"
                value={amountDollars}
                onChange={(e) => setAmountDollars(e.target.value)}
                required
              />
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
              <select
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">No invoice (general entry)</option>
                {unpaidInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} — {formatCents(inv.totalCents, inv.currency)}
                  </option>
                ))}
              </select>
              <select
                value={debitAccountId}
                onChange={(e) => setDebitAccountId(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                required
              >
                <option value="">Debit account (e.g. Bank)…</option>
                {ledgerAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
              <select
                value={creditAccountId}
                onChange={(e) => setCreditAccountId(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                required
              >
                <option value="">Credit account (e.g. AR)…</option>
                {ledgerAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
              <Input placeholder="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />
              <Button type="submit" disabled={submitting} className="sm:col-span-3 sm:w-fit">
                {submitting ? "Recording…" : "Record payment"}
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
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Amount</th>
                <th className="p-3 font-medium">Method</th>
                <th className="p-3 font-medium">Invoice</th>
                <th className="p-3 font-medium">Reference</th>
                <th className="p-3 font-medium">Journal entry</th>
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
                    No payments recorded yet.
                  </td>
                </tr>
              ) : (
                result.items.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 text-muted-foreground">{new Date(p.paymentDate).toLocaleDateString()}</td>
                    <td className="p-3 font-medium text-foreground">{formatCents(p.amountCents, p.currency)}</td>
                    <td className="p-3 text-muted-foreground">{p.method}</td>
                    <td className="p-3 text-muted-foreground">{p.invoice?.invoiceNumber ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{p.reference ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{p.journalEntry.entryNumber}</td>
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
