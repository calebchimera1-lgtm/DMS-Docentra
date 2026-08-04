"use client";

import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input, Pagination } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv } from "../../../../lib/format";
import type { Department, EmploymentType, JobPosting, Paginated } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { RecruitmentSubnav } from "../../../../components/recruitment/recruitment-subnav";

const EMPLOYMENT_TYPES: EmploymentType[] = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"];

export default function JobPostingsPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.RECRUITMENT_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<JobPosting> | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [employmentType, setEmploymentType] = useState<EmploymentType>("FULL_TIME");
  const [openings, setOpenings] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = () => {
    const qs = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (statusFilter) qs.set("status", statusFilter);
    void apiClient.get<Paginated<JobPosting>>(`/recruitment/job-postings?${qs}`).then(setResult);
  };

  useEffect(load, [statusFilter, page]);
  useEffect(() => setPage(1), [statusFilter]);
  useEffect(() => {
    void apiClient.get<Paginated<Department>>("/hr/departments?page=1&pageSize=100").then((r) => setDepartments(r.items));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/recruitment/job-postings", {
        title,
        departmentId: departmentId || undefined,
        employmentType,
        openings: parseInt(openings || "1", 10),
      });
      setTitle("");
      setDepartmentId("");
      setEmploymentType("FULL_TIME");
      setOpenings("1");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create job posting");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(id: string, action: "close" | "reopen") {
    setActionError(null);
    try {
      await apiClient.post(`/recruitment/job-postings/${id}/${action}`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : `Failed to ${action} job posting`);
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/recruitment/job-postings/export");
    downloadCsv(csv, "job-postings.csv");
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="ON_HOLD">On hold</option>
          <option value="CLOSED">Closed</option>
        </select>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
          {canWrite && (
            <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New posting
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">No department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min={1}
                placeholder="Openings"
                value={openings}
                onChange={(e) => setOpenings(e.target.value)}
              />
              <Button type="submit" disabled={submitting} className="sm:col-start-4">
                {submitting ? "Creating…" : "Create posting"}
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
                <th className="p-3 font-medium">Title</th>
                <th className="p-3 font-medium">Department</th>
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 font-medium">Openings</th>
                <th className="p-3 font-medium">Applications</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {result === null ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : result.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">
                    No job postings yet.
                  </td>
                </tr>
              ) : (
                result.items.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">{p.title}</td>
                    <td className="p-3 text-muted-foreground">{p.department?.name ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{p.employmentType}</td>
                    <td className="p-3 text-muted-foreground">{p.openings}</td>
                    <td className="p-3 text-muted-foreground">{p._count.applications}</td>
                    <td className="p-3">
                      <Badge variant={p.status === "OPEN" ? "default" : "outline"}>{p.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      {canWrite &&
                        (p.status === "CLOSED" ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => handleAction(p.id, "reopen")}>
                            Reopen
                          </Button>
                        ) : (
                          <Button type="button" size="sm" variant="outline" onClick={() => handleAction(p.id, "close")}>
                            Close
                          </Button>
                        ))}
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
