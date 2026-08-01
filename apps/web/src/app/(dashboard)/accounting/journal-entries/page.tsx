"use client";

import { Fragment, useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input, Pagination } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv, formatCents } from "../../../../lib/format";
import type { JournalEntry, LedgerAccount, Paginated } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { AccountingSubnav } from "../../../../components/accounting/accounting-subnav";
import {
  DraftJournalLine,
  JournalLinesEditor,
  emptyJournalLine,
  toJournalLinePayload,
} from "../../../../components/accounting/journal-lines-editor";

export default function JournalEntriesPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.ACCOUNTING_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<JournalEntry> | null>(null);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<DraftJournalLine[]>([emptyJournalLine(), emptyJournalLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const qs = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (status) qs.set("status", status);
    void apiClient.get<Paginated<JournalEntry>>(`/accounting/journal-entries?${qs}`).then(setResult);
  };

  useEffect(load, [status, page]);
  useEffect(() => setPage(1), [status]);
  useEffect(() => {
    void apiClient
      .get<Paginated<LedgerAccount>>("/accounting/ledger-accounts?page=1&pageSize=100")
      .then((r) => setLedgerAccounts(r.items));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = toJournalLinePayload(lines);
      await apiClient.post("/accounting/journal-entries", { entryDate, memo: memo || undefined, lines: payload });
      setMemo("");
      setLines([emptyJournalLine(), emptyJournalLine()]);
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create journal entry");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePost(id: string) {
    await apiClient.post(`/accounting/journal-entries/${id}/post`);
    load();
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/accounting/journal-entries/export");
    downloadCsv(csv, "journal-entries.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Accounting</h1>
        <p className="text-sm text-muted-foreground">Chart of accounts, journal entries, and payments.</p>
      </div>

      <AccountingSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="POSTED">Posted</option>
        </select>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
          {canWrite && (
            <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New entry
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-3">
                <Input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="max-w-xs"
                  required
                />
                <Input
                  placeholder="Memo (optional)"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className="flex-1"
                />
              </div>
              <JournalLinesEditor lines={lines} onChange={setLines} ledgerAccounts={ledgerAccounts} />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={submitting} className="self-start">
                {submitting ? "Creating…" : "Create draft entry"}
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
                <th className="p-3 font-medium">Entry #</th>
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Memo</th>
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
                    No journal entries yet.
                  </td>
                </tr>
              ) : (
                result.items.map((entry) => (
                  <Fragment key={entry.id}>
                    <tr
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    >
                      <td className="p-3 font-medium text-foreground">{entry.entryNumber}</td>
                      <td className="p-3 text-muted-foreground">{new Date(entry.entryDate).toLocaleDateString()}</td>
                      <td className="p-3 text-muted-foreground">{entry.memo ?? "—"}</td>
                      <td className="p-3">
                        <Badge variant={entry.status === "POSTED" ? "default" : "outline"}>{entry.status}</Badge>
                      </td>
                      <td className="p-3 text-right">
                        {canWrite && entry.status === "DRAFT" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePost(entry.id);
                            }}
                          >
                            Post
                          </Button>
                        )}
                      </td>
                    </tr>
                    {expandedId === entry.id && (
                      <tr className="border-b border-border bg-muted/30">
                        <td colSpan={5} className="p-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-muted-foreground">
                                <th className="pb-1 pr-4">Account</th>
                                <th className="pb-1 pr-4">Debit</th>
                                <th className="pb-1 pr-4">Credit</th>
                                <th className="pb-1">Description</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entry.lines.map((line) => (
                                <tr key={line.id}>
                                  <td className="py-1 pr-4">
                                    {line.ledgerAccount.code} — {line.ledgerAccount.name}
                                  </td>
                                  <td className="py-1 pr-4">
                                    {line.debitCents > 0 ? formatCents(line.debitCents) : ""}
                                  </td>
                                  <td className="py-1 pr-4">
                                    {line.creditCents > 0 ? formatCents(line.creditCents) : ""}
                                  </td>
                                  <td className="py-1 text-muted-foreground">{line.description ?? ""}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
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
