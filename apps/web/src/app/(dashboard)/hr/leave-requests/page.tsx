"use client";

import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input, Pagination } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv } from "../../../../lib/format";
import type { Employee, LeaveRequest, LeaveRequestStatus, LeaveType, Paginated } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { HrSubnav } from "../../../../components/hr/hr-subnav";

const STATUSES: LeaveRequestStatus[] = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
const TYPES: LeaveType[] = ["VACATION", "SICK", "UNPAID", "OTHER"];

export default function LeaveRequestsPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.HR_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<LeaveRequest> | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState<LeaveType>("VACATION");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = () => {
    const qs = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (statusFilter) qs.set("status", statusFilter);
    void apiClient.get<Paginated<LeaveRequest>>(`/hr/leave-requests?${qs}`).then(setResult);
  };

  useEffect(load, [statusFilter, page]);
  useEffect(() => setPage(1), [statusFilter]);
  useEffect(() => {
    void apiClient.get<Paginated<Employee>>("/hr/employees?page=1&pageSize=100").then((r) => setEmployees(r.items));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/hr/leave-requests", {
        employeeId,
        type,
        startDate,
        endDate,
        reason: reason || undefined,
      });
      setReason("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit leave request");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(id: string, action: "approve" | "reject" | "cancel") {
    setActionError(null);
    try {
      await apiClient.post(`/hr/leave-requests/${id}/${action}`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : `Failed to ${action} leave request`);
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/hr/leave-requests/export");
    downloadCsv(csv, "leave-requests.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">HR</h1>
        <p className="text-sm text-muted-foreground">Departments, employees, and leave requests.</p>
      </div>

      <HrSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
          {canWrite && (
            <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New request
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                required
              >
                <option value="">Select employee…</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as LeaveType)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <Input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              <Button type="submit" disabled={submitting} className="sm:col-start-3">
                {submitting ? "Submitting…" : "Submit request"}
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
                <th className="p-3 font-medium">Employee</th>
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 font-medium">Dates</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Approver</th>
                <th className="p-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {result === null ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : result.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    No leave requests yet.
                  </td>
                </tr>
              ) : (
                result.items.map((lr) => (
                  <tr key={lr.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">
                      {lr.employee.firstName} {lr.employee.lastName}
                    </td>
                    <td className="p-3 text-muted-foreground">{lr.type}</td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(lr.startDate).toLocaleDateString()} – {new Date(lr.endDate).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={
                          lr.status === "APPROVED"
                            ? "default"
                            : lr.status === "PENDING"
                              ? "warning"
                              : lr.status === "REJECTED"
                                ? "outline"
                                : "secondary"
                        }
                      >
                        {lr.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {lr.approver ? `${lr.approver.firstName} ${lr.approver.lastName}` : "—"}
                    </td>
                    <td className="p-3 text-right">
                      {canWrite && lr.status === "PENDING" && (
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" onClick={() => handleAction(lr.id, "approve")}>
                            Approve
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => handleAction(lr.id, "reject")}>
                            Reject
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => handleAction(lr.id, "cancel")}>
                            Cancel
                          </Button>
                        </div>
                      )}
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
