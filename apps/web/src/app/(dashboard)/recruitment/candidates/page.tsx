"use client";

import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Button, Card, CardContent, Input } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv } from "../../../../lib/format";
import type { Candidate, Paginated } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { RecruitmentSubnav } from "../../../../components/recruitment/recruitment-subnav";

export default function CandidatesPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.RECRUITMENT_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<Candidate> | null>(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const qs = new URLSearchParams({ page: "1", pageSize: "50" });
    if (search) qs.set("search", search);
    void apiClient.get<Paginated<Candidate>>(`/recruitment/candidates?${qs}`).then(setResult);
  };

  useEffect(load, [search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/recruitment/candidates", { firstName, lastName, email, source: source || undefined });
      setFirstName("");
      setLastName("");
      setEmail("");
      setSource("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create candidate");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/recruitment/candidates/export");
    downloadCsv(csv, "candidates.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Recruitment</h1>
        <p className="text-sm text-muted-foreground">
          Job postings, candidates, and the application pipeline through to hire.
        </p>
      </div>

      <RecruitmentSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Search candidates…"
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
              New candidate
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-5">
              <Input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Input placeholder="Source (optional)" value={source} onChange={(e) => setSource(e.target.value)} />
              <Button type="submit" disabled={submitting} className="sm:col-start-5">
                {submitting ? "Creating…" : "Create candidate"}
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
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Phone</th>
                <th className="p-3 font-medium">Source</th>
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
                    No candidates yet.
                  </td>
                </tr>
              ) : (
                result.items.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">
                      {c.firstName} {c.lastName}
                    </td>
                    <td className="p-3 text-muted-foreground">{c.email}</td>
                    <td className="p-3 text-muted-foreground">{c.phone ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{c.source ?? "—"}</td>
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
