"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input, Pagination } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv } from "../../../../lib/format";
import type { Paginated, Ticket, TicketPriority, TicketStatus } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { SupportSubnav } from "../../../../components/support/support-subnav";

const STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED"];
const PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export default function TicketsPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.SUPPORT_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<Ticket> | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const qs = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (search) qs.set("search", search);
    if (statusFilter) qs.set("status", statusFilter);
    void apiClient.get<Paginated<Ticket>>(`/support/tickets?${qs}`).then(setResult);
  };

  useEffect(load, [search, statusFilter, page]);
  useEffect(() => setPage(1), [search, statusFilter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/support/tickets", {
        subject,
        priority,
        requesterEmail: requesterEmail || undefined,
      });
      setSubject("");
      setRequesterEmail("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create ticket");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/support/tickets/export");
    downloadCsv(csv, "tickets.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Support</h1>
        <p className="text-sm text-muted-foreground">Helpdesk tickets.</p>
      </div>

      <SupportSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search tickets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
              New ticket
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Input
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="sm:col-span-2"
                required
              />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Requester email (optional)"
                value={requesterEmail}
                onChange={(e) => setRequesterEmail(e.target.value)}
              />
              <Button type="submit" disabled={submitting} className="sm:col-start-4">
                {submitting ? "Creating…" : "Create ticket"}
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
                <th className="p-3 font-medium">Ticket #</th>
                <th className="p-3 font-medium">Subject</th>
                <th className="p-3 font-medium">Priority</th>
                <th className="p-3 font-medium">Assignee</th>
                <th className="p-3 font-medium">Status</th>
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
                    No tickets yet.
                  </td>
                </tr>
              ) : (
                result.items.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">
                      <Link href={`/support/tickets/${t.id}`} className="hover:underline">
                        {t.ticketNumber}
                      </Link>
                    </td>
                    <td className="p-3 text-muted-foreground">{t.subject}</td>
                    <td className="p-3">
                      <Badge variant="outline">{t.priority}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : "—"}
                    </td>
                    <td className="p-3">
                      <Badge variant={t.status === "OPEN" || t.status === "IN_PROGRESS" ? "default" : "outline"}>
                        {t.status}
                      </Badge>
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
