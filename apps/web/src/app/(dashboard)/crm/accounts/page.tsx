"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Button, Card, CardContent, Input } from "@omniflow/ui";
import { apiClient } from "../../../../lib/api-client";
import { downloadCsv } from "../../../../lib/format";
import type { CrmAccount, Paginated } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { CrmSubnav } from "../../../../components/crm/crm-subnav";

export default function CrmAccountsPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.CRM_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<CrmAccount> | null>(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    const qs = new URLSearchParams({ page: "1", pageSize: "50" });
    if (search) qs.set("search", search);
    void apiClient.get<Paginated<CrmAccount>>(`/crm/accounts?${qs}`).then(setResult);
  };

  useEffect(load, [search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.post("/crm/accounts", {
        name,
        industry: industry || undefined,
        website: website || undefined,
      });
      setName("");
      setIndustry("");
      setWebsite("");
      setShowCreate(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/crm/accounts/export");
    downloadCsv(csv, "crm-accounts.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">CRM</h1>
        <p className="text-sm text-muted-foreground">Accounts, contacts, leads, and the sales pipeline.</p>
      </div>

      <CrmSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Search accounts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
          {canWrite && (
            <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New account
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input placeholder="Industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
              <Input placeholder="Website" value={website} onChange={(e) => setWebsite(e.target.value)} />
              <Button type="submit" disabled={submitting} className="sm:col-start-3">
                {submitting ? "Creating…" : "Create account"}
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
                <th className="p-3 font-medium">Industry</th>
                <th className="p-3 font-medium">Contacts</th>
                <th className="p-3 font-medium">Deals</th>
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
                    No accounts yet.
                  </td>
                </tr>
              ) : (
                result.items.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3">
                      <Link href={`/crm/accounts/${a.id}`} className="font-medium text-foreground hover:underline">
                        {a.name}
                      </Link>
                    </td>
                    <td className="p-3 text-muted-foreground">{a.industry ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{a._count?.contacts ?? 0}</td>
                    <td className="p-3 text-muted-foreground">{a._count?.deals ?? 0}</td>
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
