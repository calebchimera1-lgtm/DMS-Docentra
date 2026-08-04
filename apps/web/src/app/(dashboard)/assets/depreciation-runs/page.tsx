"use client";

import { Fragment, useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input, Pagination } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv, formatCents } from "../../../../lib/format";
import type { DepreciationLine, DepreciationRun, Paginated } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { AssetsSubnav } from "../../../../components/assets/assets-subnav";

export default function DepreciationRunsPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.ASSETS_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<DepreciationRun> | null>(null);
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [periodDate, setPeriodDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [linesByRun, setLinesByRun] = useState<Record<string, DepreciationLine[]>>({});

  const load = () => {
    void apiClient
      .get<Paginated<DepreciationRun>>(`/assets/depreciation-runs?page=${page}&pageSize=50`)
      .then(setResult);
  };

  useEffect(load, [page]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/assets/depreciation-runs", { periodDate });
      setPeriodDate("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create depreciation run");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(id: string, action: "generate" | "cancel") {
    setActionError(null);
    try {
      await apiClient.post(`/assets/depreciation-runs/${id}/${action}`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : `Failed to ${action} depreciation run`);
    }
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!linesByRun[id]) {
      const r = await apiClient.get<Paginated<DepreciationLine>>(
        `/assets/depreciation-lines?depreciationRunId=${id}&pageSize=100`,
      );
      setLinesByRun((prev) => ({ ...prev, [id]: r.items }));
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/assets/depreciation-runs/export");
    downloadCsv(csv, "depreciation-runs.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Assets</h1>
        <p className="text-sm text-muted-foreground">
          Fixed asset register, straight-line depreciation, and disposals.
        </p>
      </div>

      <AssetsSubnav />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-1 h-3.5 w-3.5" />
          Export CSV
        </Button>
        {canWrite && (
          <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New depreciation run
          </Button>
        )}
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                type="date"
                placeholder="Period date (e.g. month-end)"
                value={periodDate}
                onChange={(e) => setPeriodDate(e.target.value)}
                required
              />
              <Button type="submit" disabled={submitting} className="sm:col-start-3">
                {submitting ? "Creating…" : "Create draft run"}
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
                <th className="p-3 font-medium">Lines</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium" />
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
                    No depreciation runs yet.
                  </td>
                </tr>
              ) : (
                result.items.map((run) => (
                  <Fragment key={run.id}>
                    <tr
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                      onClick={() => toggleExpand(run.id)}
                    >
                      <td className="p-3 font-medium text-foreground">
                        {new Date(run.periodDate).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-muted-foreground">{run._count.lines}</td>
                      <td className="p-3">
                        <Badge variant={run.status === "POSTED" ? "default" : "outline"}>{run.status}</Badge>
                      </td>
                      <td className="p-3 text-right">
                        {canWrite && run.status === "DRAFT" && (
                          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button type="button" size="sm" onClick={() => handleAction(run.id, "generate")}>
                              Generate
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleAction(run.id, "cancel")}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {expandedId === run.id && (
                      <tr className="border-b border-border bg-muted/30">
                        <td colSpan={4} className="p-3">
                          {(() => {
                            const lines = linesByRun[run.id];
                            if (!lines) {
                              return <p className="text-xs text-muted-foreground">Loading lines…</p>;
                            }
                            if (lines.length === 0) {
                              return <p className="text-xs text-muted-foreground">No depreciation posted yet.</p>;
                            }
                            return (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-left text-muted-foreground">
                                    <th className="pb-1 pr-4">Asset</th>
                                    <th className="pb-1 pr-4">Amount</th>
                                    <th className="pb-1">Accumulated after</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {lines.map((l) => (
                                    <tr key={l.id}>
                                      <td className="py-1 pr-4">
                                        {l.asset.assetNumber} — {l.asset.name}
                                      </td>
                                      <td className="py-1 pr-4">{formatCents(l.amountCents)}</td>
                                      <td className="py-1">{formatCents(l.accumulatedAfterCents)}</td>
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
