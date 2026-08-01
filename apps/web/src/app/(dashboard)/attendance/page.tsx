"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Clock, Download, PlaneTakeoff, UserX } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Pagination } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../lib/api-client";
import { downloadCsv } from "../../../lib/format";
import type {
  AttendanceByStatus,
  AttendanceRecord,
  AttendanceStatus,
  AttendanceSummary,
  Employee,
  Paginated,
} from "../../../lib/types";
import { useAuth } from "../../../providers/auth-provider";
import { StageBarChart } from "../../../components/crm/stage-bar-chart";
import { StatTile } from "../../../components/stat-tile";

const MARK_STATUSES: AttendanceStatus[] = ["ABSENT", "ON_LEAVE", "HALF_DAY"];

export default function AttendancePage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.ATTENDANCE_WRITE) ?? false;

  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [byStatus, setByStatus] = useState<AttendanceByStatus[] | null>(null);
  const [result, setResult] = useState<Paginated<AttendanceRecord> | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | "">("");
  const [page, setPage] = useState(1);

  const [clockInEmployeeId, setClockInEmployeeId] = useState("");
  const [markEmployeeId, setMarkEmployeeId] = useState("");
  const [markDate, setMarkDate] = useState("");
  const [markStatus, setMarkStatus] = useState<AttendanceStatus>("ABSENT");
  const [markNote, setMarkNote] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    const qs = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (statusFilter) qs.set("status", statusFilter);
    void apiClient.get<Paginated<AttendanceRecord>>(`/attendance?${qs}`).then(setResult);
    void apiClient.get<AttendanceSummary>("/attendance/reports/summary").then(setSummary);
    void apiClient.get<AttendanceByStatus[]>("/attendance/reports/by-status").then(setByStatus);
  };

  useEffect(load, [statusFilter, page]);
  useEffect(() => setPage(1), [statusFilter]);
  useEffect(() => {
    void apiClient.get<Paginated<Employee>>("/hr/employees?page=1&pageSize=100").then((r) => setEmployees(r.items));
  }, []);

  async function handleClockIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiClient.post("/attendance/clock-in", { employeeId: clockInEmployeeId });
      setClockInEmployeeId("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to clock in");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClockOut(id: string) {
    setError(null);
    try {
      await apiClient.post(`/attendance/${id}/clock-out`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to clock out");
    }
  }

  async function handleMark(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiClient.post("/attendance/mark", {
        employeeId: markEmployeeId,
        date: markDate,
        status: markStatus,
        note: markNote || undefined,
      });
      setMarkEmployeeId("");
      setMarkDate("");
      setMarkNote("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to mark attendance");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/attendance/export");
    downloadCsv(csv, "attendance.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Attendance</h1>
        <p className="text-sm text-muted-foreground">Clock-in/out tracking with automatic lateness detection.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Present today" value={summary?.presentCount ?? "—"} icon={CalendarCheck} />
        <StatTile label="Late today" value={summary?.lateCount ?? "—"} icon={Clock} />
        <StatTile label="Absent today" value={summary?.absentCount ?? "—"} icon={UserX} />
        <StatTile label="On leave today" value={summary?.onLeaveCount ?? "—"} icon={PlaneTakeoff} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today's attendance by status</CardTitle>
        </CardHeader>
        <CardContent>
          {byStatus ? (
            <StageBarChart
              ariaLabel="Attendance count by status today"
              data={byStatus.map((s) => ({ label: s.status, value: s.count, displayValue: String(s.count) }))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </CardContent>
      </Card>

      {canWrite && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Clock in</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleClockIn} className="flex flex-wrap items-end gap-3">
                <select
                  value={clockInEmployeeId}
                  onChange={(e) => setClockInEmployeeId(e.target.value)}
                  className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm"
                  required
                >
                  <option value="">Select employee…</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employeeNumber} — {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </select>
                <Button type="submit" disabled={submitting}>
                  Clock in
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mark absence / leave / half-day</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleMark} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <select
                  value={markEmployeeId}
                  onChange={(e) => setMarkEmployeeId(e.target.value)}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                  required
                >
                  <option value="">Select employee…</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employeeNumber} — {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </select>
                <Input type="date" value={markDate} onChange={(e) => setMarkDate(e.target.value)} required />
                <select
                  value={markStatus}
                  onChange={(e) => setMarkStatus(e.target.value as AttendanceStatus)}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                >
                  {MARK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <Input placeholder="Note (optional)" value={markNote} onChange={(e) => setMarkNote(e.target.value)} />
                <Button type="submit" disabled={submitting} className="sm:col-span-2">
                  Mark
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AttendanceStatus | "")}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="PRESENT">Present</option>
          <option value="LATE">Late</option>
          <option value="HALF_DAY">Half day</option>
          <option value="ABSENT">Absent</option>
          <option value="ON_LEAVE">On leave</option>
        </select>
        <Button type="button" variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-1 h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Employee</th>
                <th className="p-3 font-medium">Clock in</th>
                <th className="p-3 font-medium">Clock out</th>
                <th className="p-3 font-medium">Worked</th>
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
                    No attendance records yet.
                  </td>
                </tr>
              ) : (
                result.items.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 text-muted-foreground">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="p-3 font-medium text-foreground">
                      {r.employee.employeeNumber} — {r.employee.firstName} {r.employee.lastName}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {r.clockInAt ? new Date(r.clockInAt).toLocaleTimeString() : "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {r.clockOutAt ? new Date(r.clockOutAt).toLocaleTimeString() : "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {r.workedMinutes !== null ? `${r.workedMinutes} min` : "—"}
                    </td>
                    <td className="p-3">
                      <Badge variant={r.status === "PRESENT" ? "default" : "outline"}>{r.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      {canWrite && r.clockInAt && !r.clockOutAt && (
                        <Button type="button" size="sm" variant="outline" onClick={() => handleClockOut(r.id)}>
                          Clock out
                        </Button>
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
