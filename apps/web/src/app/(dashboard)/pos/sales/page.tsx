"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv, formatCents } from "../../../../lib/format";
import type { Paginated, PosSale, PosSaleStatus } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { PosSubnav } from "../../../../components/pos/pos-subnav";

export default function PosSalesPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.POS_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<PosSale> | null>(null);
  const [statusFilter, setStatusFilter] = useState<PosSaleStatus | "">("");
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"void" | "refund" | null>(null);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const load = () => {
    const qs = new URLSearchParams({ page: "1", pageSize: "50" });
    if (statusFilter) qs.set("status", statusFilter);
    void apiClient.get<Paginated<PosSale>>(`/pos/sales?${qs}`).then(setResult);
  };

  useEffect(load, [statusFilter]);

  function startAction(id: string, type: "void" | "refund") {
    setActioningId(id);
    setActionType(type);
    setReason("");
    setActionError(null);
  }

  async function confirmAction() {
    if (!actioningId || !actionType) return;
    setActionError(null);
    try {
      if (actionType === "void") {
        await apiClient.post(`/pos/sales/${actioningId}/void`, { voidReason: reason });
      } else {
        await apiClient.post(`/pos/sales/${actioningId}/refund`, { refundReason: reason });
      }
      setActioningId(null);
      setActionType(null);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : `Failed to ${actionType} sale`);
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/pos/sales/export");
    downloadCsv(csv, "pos-sales.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Point of Sale</h1>
        <p className="text-sm text-muted-foreground">
          Register sessions and sales, with immediate stock deduction and cash reconciliation.
        </p>
      </div>

      <PosSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PosSaleStatus | "")}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="VOIDED">Voided</option>
          <option value="REFUNDED">Refunded</option>
        </select>
        <Button type="button" variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-1 h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {actioningId && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-4">
            <Input
              placeholder={actionType === "void" ? "Reason for voiding" : "Reason for refund"}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="max-w-sm"
            />
            <Button type="button" size="sm" disabled={!reason} onClick={confirmAction}>
              Confirm {actionType}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setActioningId(null)}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">Sale</th>
                <th className="p-3 font-medium">Session</th>
                <th className="p-3 font-medium">Payment</th>
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
                    No sales yet.
                  </td>
                </tr>
              ) : (
                result.items.map((sale) => (
                  <tr key={sale.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">{sale.saleNumber}</td>
                    <td className="p-3 text-muted-foreground">{sale.session.sessionNumber}</td>
                    <td className="p-3 text-muted-foreground">{sale.paymentMethod}</td>
                    <td className="p-3 text-muted-foreground">{formatCents(sale.totalCents, sale.currency)}</td>
                    <td className="p-3">
                      <Badge variant={sale.status === "COMPLETED" ? "default" : "outline"}>{sale.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      {canWrite && sale.status === "COMPLETED" && (
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => startAction(sale.id, "void")}>
                            Void
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => startAction(sale.id, "refund")}>
                            Refund
                          </Button>
                        </div>
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
