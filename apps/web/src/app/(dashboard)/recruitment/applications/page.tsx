"use client";

import { Fragment, useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv } from "../../../../lib/format";
import type {
  Application,
  Candidate,
  Department,
  Interview,
  JobPosting,
  Paginated,
} from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { RecruitmentSubnav } from "../../../../components/recruitment/recruitment-subnav";

export default function ApplicationsPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.RECRUITMENT_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<Application> | null>(null);
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [statusFilter, setStatusFilter] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [jobPostingId, setJobPostingId] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [interviewsByApp, setInterviewsByApp] = useState<Record<string, Interview[]>>({});

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [hiringId, setHiringId] = useState<string | null>(null);
  const [hireDate, setHireDate] = useState("");
  const [hireSalary, setHireSalary] = useState("");
  const [hireDepartmentId, setHireDepartmentId] = useState("");

  const load = () => {
    const qs = new URLSearchParams({ page: "1", pageSize: "50" });
    if (statusFilter) qs.set("status", statusFilter);
    void apiClient.get<Paginated<Application>>(`/recruitment/applications?${qs}`).then(setResult);
  };

  useEffect(load, [statusFilter]);
  useEffect(() => {
    void apiClient
      .get<Paginated<JobPosting>>("/recruitment/job-postings?page=1&pageSize=100&status=OPEN")
      .then((r) => setJobPostings(r.items));
    void apiClient.get<Paginated<Candidate>>("/recruitment/candidates?page=1&pageSize=100").then((r) => setCandidates(r.items));
    void apiClient.get<Paginated<Department>>("/hr/departments?page=1&pageSize=100").then((r) => setDepartments(r.items));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/recruitment/applications", { jobPostingId, candidateId });
      setJobPostingId("");
      setCandidateId("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create application");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(id: string, action: "screen" | "interview" | "offer" | "withdraw") {
    setActionError(null);
    try {
      await apiClient.post(`/recruitment/applications/${id}/${action}`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : `Failed to ${action} application`);
    }
  }

  async function handleReject(id: string) {
    setActionError(null);
    try {
      await apiClient.post(`/recruitment/applications/${id}/reject`, { rejectionReason });
      setRejectingId(null);
      setRejectionReason("");
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to reject application");
    }
  }

  async function handleHire(id: string) {
    setActionError(null);
    try {
      await apiClient.post(`/recruitment/applications/${id}/hire`, {
        hireDate,
        salaryCents: hireSalary ? Math.round(parseFloat(hireSalary) * 100) : undefined,
        departmentId: hireDepartmentId || undefined,
      });
      setHiringId(null);
      setHireDate("");
      setHireSalary("");
      setHireDepartmentId("");
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to hire candidate");
    }
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!interviewsByApp[id]) {
      const r = await apiClient.get<Paginated<Interview>>(`/recruitment/interviews?applicationId=${id}&pageSize=50`);
      setInterviewsByApp((prev) => ({ ...prev, [id]: r.items }));
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/recruitment/applications/export");
    downloadCsv(csv, "applications.csv");
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
          <option value="APPLIED">Applied</option>
          <option value="SCREENING">Screening</option>
          <option value="INTERVIEWING">Interviewing</option>
          <option value="OFFERED">Offered</option>
          <option value="HIRED">Hired</option>
          <option value="REJECTED">Rejected</option>
          <option value="WITHDRAWN">Withdrawn</option>
        </select>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
          {canWrite && (
            <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New application
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <select
                value={jobPostingId}
                onChange={(e) => setJobPostingId(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                required
              >
                <option value="">Job posting…</option>
                {jobPostings.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <select
                value={candidateId}
                onChange={(e) => setCandidateId(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                required
              >
                <option value="">Candidate…</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </select>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create application"}
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
                <th className="p-3 font-medium">Job posting</th>
                <th className="p-3 font-medium">Candidate</th>
                <th className="p-3 font-medium">Applied</th>
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
                    No applications yet.
                  </td>
                </tr>
              ) : (
                result.items.map((app) => (
                  <Fragment key={app.id}>
                    <tr
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                      onClick={() => toggleExpand(app.id)}
                    >
                      <td className="p-3 font-medium text-foreground">{app.jobPosting.title}</td>
                      <td className="p-3 text-muted-foreground">
                        {app.candidate.firstName} {app.candidate.lastName}
                      </td>
                      <td className="p-3 text-muted-foreground">{new Date(app.appliedAt).toLocaleDateString()}</td>
                      <td className="p-3">
                        <Badge variant={app.status === "HIRED" ? "default" : "outline"}>{app.status}</Badge>
                      </td>
                      <td className="p-3 text-right">
                        {canWrite && (
                          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            {app.status === "APPLIED" && (
                              <Button type="button" size="sm" onClick={() => handleAction(app.id, "screen")}>
                                Screen
                              </Button>
                            )}
                            {app.status === "SCREENING" && (
                              <Button type="button" size="sm" onClick={() => handleAction(app.id, "interview")}>
                                Move to interviewing
                              </Button>
                            )}
                            {app.status === "INTERVIEWING" && (
                              <Button type="button" size="sm" onClick={() => handleAction(app.id, "offer")}>
                                Offer
                              </Button>
                            )}
                            {app.status === "OFFERED" && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  setHiringId(hiringId === app.id ? null : app.id);
                                  setRejectingId(null);
                                }}
                              >
                                Hire
                              </Button>
                            )}
                            {["APPLIED", "SCREENING", "INTERVIEWING", "OFFERED"].includes(app.status) && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setRejectingId(rejectingId === app.id ? null : app.id);
                                    setHiringId(null);
                                  }}
                                >
                                  Reject
                                </Button>
                                <Button type="button" size="sm" variant="outline" onClick={() => handleAction(app.id, "withdraw")}>
                                  Withdraw
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>

                    {rejectingId === app.id && (
                      <tr className="border-b border-border bg-muted/30">
                        <td colSpan={5} className="p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              placeholder="Reason for rejection"
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              className="max-w-sm"
                            />
                            <Button type="button" size="sm" disabled={!rejectionReason} onClick={() => handleReject(app.id)}>
                              Confirm reject
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setRejectingId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {hiringId === app.id && (
                      <tr className="border-b border-border bg-muted/30">
                        <td colSpan={5} className="p-3">
                          <div className="flex flex-wrap items-end gap-2">
                            <Input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} className="w-40" />
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Annual salary (optional)"
                              value={hireSalary}
                              onChange={(e) => setHireSalary(e.target.value)}
                              className="w-44"
                            />
                            <select
                              value={hireDepartmentId}
                              onChange={(e) => setHireDepartmentId(e.target.value)}
                              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                            >
                              <option value="">Department (optional)…</option>
                              {departments.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                            <Button type="button" size="sm" disabled={!hireDate} onClick={() => handleHire(app.id)}>
                              Confirm hire
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setHiringId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {expandedId === app.id && (
                      <tr className="border-b border-border bg-muted/30">
                        <td colSpan={5} className="p-3">
                          {app.notes && <p className="text-xs text-muted-foreground">Notes: {app.notes}</p>}
                          {app.rejectionReason && (
                            <p className="text-xs text-red-600">Rejected: {app.rejectionReason}</p>
                          )}
                          {app.hiredEmployee && (
                            <p className="text-xs text-muted-foreground">
                              Hired as employee {app.hiredEmployee.employeeNumber}
                            </p>
                          )}
                          {(() => {
                            const interviews = interviewsByApp[app.id];
                            if (!interviews) {
                              return <p className="mt-2 text-xs text-muted-foreground">Loading interviews…</p>;
                            }
                            if (interviews.length === 0) {
                              return <p className="mt-2 text-xs text-muted-foreground">No interviews scheduled.</p>;
                            }
                            return (
                              <table className="mt-2 w-full text-xs">
                                <thead>
                                  <tr className="text-left text-muted-foreground">
                                    <th className="pb-1 pr-4">Stage</th>
                                    <th className="pb-1 pr-4">Scheduled</th>
                                    <th className="pb-1 pr-4">Status</th>
                                    <th className="pb-1">Rating</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {interviews.map((iv) => (
                                    <tr key={iv.id}>
                                      <td className="py-1 pr-4">{iv.stage}</td>
                                      <td className="py-1 pr-4">{new Date(iv.scheduledAt).toLocaleString()}</td>
                                      <td className="py-1 pr-4">{iv.status}</td>
                                      <td className="py-1">{iv.rating ?? "—"}</td>
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
        </CardContent>
      </Card>
    </div>
  );
}
