"use client";

import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input } from "@omniflow/ui";
import { apiClient } from "../../../../lib/api-client";
import { downloadCsv } from "../../../../lib/format";
import type { CrmLead, CrmLeadStatus, Paginated } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { CrmSubnav } from "../../../../components/crm/crm-subnav";

const STATUSES: CrmLeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"];

export default function CrmLeadsPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.CRM_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<CrmLead> | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [source, setSource] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    const qs = new URLSearchParams({ page: "1", pageSize: "50" });
    if (search) qs.set("search", search);
    if (status) qs.set("status", status);
    void apiClient.get<Paginated<CrmLead>>(`/crm/leads?${qs}`).then(setResult);
  };

  useEffect(load, [search, status]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.post("/crm/leads", {
        firstName,
        lastName,
        companyName: companyName || undefined,
        source: source || undefined,
      });
      setFirstName("");
      setLastName("");
      setCompanyName("");
      setSource("");
      setShowCreate(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConvert(id: string) {
    await apiClient.post(`/crm/leads/${id}/convert`);
    load();
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/crm/leads/export");
    downloadCsv(csv, "crm-leads.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">CRM</h1>
        <p className="text-sm text-muted-foreground">Accounts, contacts, leads, and the sales pipeline.</p>
      </div>

      <CrmSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search leads…"
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
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
          {canWrite && (
            <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New lead
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              <Input placeholder="Company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              <Input placeholder="Source" value={source} onChange={(e) => setSource(e.target.value)} />
              <Button type="submit" disabled={submitting} className="sm:col-start-4">
                {submitting ? "Creating…" : "Create lead"}
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
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Company</th>
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
                    No leads yet.
                  </td>
                </tr>
              ) : (
                result.items.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">
                      {l.firstName} {l.lastName}
                    </td>
                    <td className="p-3 text-muted-foreground">{l.companyName ?? "—"}</td>
                    <td className="p-3">
                      <Badge variant={l.status === "CONVERTED" ? "default" : "outline"}>{l.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      {canWrite && l.status !== "CONVERTED" && l.status !== "LOST" && (
                        <Button type="button" size="sm" variant="outline" onClick={() => handleConvert(l.id)}>
                          Convert
                        </Button>
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
