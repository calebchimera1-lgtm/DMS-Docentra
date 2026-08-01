"use client";

import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Button, Card, CardContent, Input, Pagination } from "@omniflow/ui";
import { apiClient } from "../../../../lib/api-client";
import { downloadCsv } from "../../../../lib/format";
import type { CrmAccount, CrmContact, Paginated } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { CrmSubnav } from "../../../../components/crm/crm-subnav";

export default function CrmContactsPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.CRM_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<CrmContact> | null>(null);
  const [accounts, setAccounts] = useState<CrmAccount[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [accountId, setAccountId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    const qs = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (search) qs.set("search", search);
    void apiClient.get<Paginated<CrmContact>>(`/crm/contacts?${qs}`).then(setResult);
  };

  useEffect(load, [search, page]);
  useEffect(() => setPage(1), [search]);
  useEffect(() => {
    void apiClient
      .get<Paginated<CrmAccount>>("/crm/accounts?page=1&pageSize=100")
      .then((r) => setAccounts(r.items));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.post("/crm/contacts", {
        firstName,
        lastName,
        email: email || undefined,
        accountId: accountId || undefined,
      });
      setFirstName("");
      setLastName("");
      setEmail("");
      setAccountId("");
      setShowCreate(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/crm/contacts/export");
    downloadCsv(csv, "crm-contacts.csv");
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
          placeholder="Search contacts…"
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
              New contact
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
              <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">No account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <Button type="submit" disabled={submitting} className="sm:col-start-4">
                {submitting ? "Creating…" : "Create contact"}
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
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Account</th>
              </tr>
            </thead>
            <tbody>
              {result === null ? (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : result.items.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-muted-foreground">
                    No contacts yet.
                  </td>
                </tr>
              ) : (
                result.items.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">
                      {c.firstName} {c.lastName}
                    </td>
                    <td className="p-3 text-muted-foreground">{c.email ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{c.account?.name ?? "—"}</td>
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
