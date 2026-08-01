"use client";

import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input, Pagination } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv } from "../../../../lib/format";
import type { Department, Paginated } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { HrSubnav } from "../../../../components/hr/hr-subnav";

export default function DepartmentsPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.HR_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<Department> | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const qs = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (search) qs.set("search", search);
    void apiClient.get<Paginated<Department>>(`/hr/departments?${qs}`).then(setResult);
  };

  useEffect(load, [search, page]);
  useEffect(() => setPage(1), [search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/hr/departments", { name, code });
      setName("");
      setCode("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create department");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/hr/departments/export");
    downloadCsv(csv, "departments.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">HR</h1>
        <p className="text-sm text-muted-foreground">Departments, employees, and leave requests.</p>
      </div>

      <HrSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Search departments…"
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
              New department
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input placeholder="Code (e.g. ENG)" value={code} onChange={(e) => setCode(e.target.value)} required />
              <Button type="submit" disabled={submitting} className="sm:col-start-3">
                {submitting ? "Creating…" : "Create department"}
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
                <th className="p-3 font-medium">Code</th>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Manager</th>
                <th className="p-3 font-medium">Status</th>
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
                    No departments yet.
                  </td>
                </tr>
              ) : (
                result.items.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">{d.code}</td>
                    <td className="p-3 text-muted-foreground">{d.name}</td>
                    <td className="p-3 text-muted-foreground">
                      {d.manager ? `${d.manager.firstName} ${d.manager.lastName}` : "—"}
                    </td>
                    <td className="p-3">
                      <Badge variant={d.isActive ? "default" : "outline"}>{d.isActive ? "Active" : "Inactive"}</Badge>
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
