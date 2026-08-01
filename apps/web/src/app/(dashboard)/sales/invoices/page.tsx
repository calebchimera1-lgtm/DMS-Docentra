"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input, Pagination } from "@omniflow/ui";
import { apiClient } from "../../../../lib/api-client";
import { downloadCsv, formatCents } from "../../../../lib/format";
import type { Invoice, InvoiceStatus, Paginated } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { SalesSubnav } from "../../../../components/sales/sales-subnav";

const STATUSES: InvoiceStatus[] = ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"];

export default function InvoicesPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.SALES_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<Invoice> | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const load = () => {
    const qs = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (search) qs.set("search", search);
    if (status) qs.set("status", status);
    void apiClient.get<Paginated<Invoice>>(`/sales/invoices?${qs}`).then(setResult);
  };

  useEffect(load, [search, status, page]);
  useEffect(() => setPage(1), [search, status]);

  async function handleMarkPaid(id: string) {
    await apiClient.post(`/sales/invoices/${id}/mark-paid`);
    load();
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/sales/invoices/export");
    downloadCsv(csv, "invoices.csv");
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
            placeholder="Search invoices…"
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
        <Button type="button" variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-1 h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Invoices are created by converting a sales order — see the Orders tab.
      </p>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">Invoice #</th>
                <th className="p-3 font-medium">Account</th>
                <th className="p-3 font-medium">Total</th>
                <th className="p-3 font-medium">Due</th>
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
                    No invoices yet.
                  </td>
                </tr>
              ) : (
                result.items.map((inv) => (
                  <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">{inv.invoiceNumber}</td>
                    <td className="p-3 text-muted-foreground">{inv.account?.name ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{formatCents(inv.totalCents, inv.currency)}</td>
                    <td className="p-3 text-muted-foreground">
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-3">
                      <Badge variant={inv.status === "PAID" ? "default" : "outline"}>{inv.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      {canWrite && inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                        <Button type="button" size="sm" variant="outline" onClick={() => handleMarkPaid(inv.id)}>
                          Mark paid
                        </Button>
                      )}
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
