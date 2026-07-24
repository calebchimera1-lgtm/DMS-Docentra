"use client";

import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv } from "../../../../lib/format";
import type { Department, Employee, EmployeeStatus, Paginated } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { HrSubnav } from "../../../../components/hr/hr-subnav";

const STATUSES: EmployeeStatus[] = ["ACTIVE", "ON_LEAVE", "TERMINATED"];

export default function EmployeesPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.HR_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<Employee> | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [hireDate, setHireDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [departmentId, setDepartmentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const qs = new URLSearchParams({ page: "1", pageSize: "50" });
    if (search) qs.set("search", search);
    if (statusFilter) qs.set("status", statusFilter);
    void apiClient.get<Paginated<Employee>>(`/hr/employees?${qs}`).then(setResult);
  };

  useEffect(load, [search, statusFilter]);
  useEffect(() => {
    void apiClient.get<Paginated<Department>>("/hr/departments?page=1&pageSize=100").then((r) => setDepartments(r.items));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/hr/employees", {
        firstName,
        lastName,
        email: email || undefined,
        jobTitle: jobTitle || undefined,
        hireDate,
        departmentId: departmentId || undefined,
      });
      setFirstName("");
      setLastName("");
      setEmail("");
      setJobTitle("");
      setDepartmentId("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create employee");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTerminate(id: string) {
    await apiClient.post(`/hr/employees/${id}/terminate`);
    load();
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/hr/employees/export");
    downloadCsv(csv, "employees.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">HR</h1>
        <p className="text-sm text-muted-foreground">Departments, employees, and leave requests.</p>
      </div>

      <HrSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search employees…"
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
              New employee
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              <Input placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input placeholder="Job title (optional)" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
              <Input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} required />
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
              <Button type="submit" disabled={submitting} className="sm:col-start-3">
                {submitting ? "Creating…" : "Create employee"}
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
                <th className="p-3 font-medium">Employee #</th>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Department</th>
                <th className="p-3 font-medium">Job title</th>
                <th className="p-3 font-medium">Status</th>
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
                    No employees yet.
                  </td>
                </tr>
              ) : (
                result.items.map((emp) => (
                  <tr key={emp.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">{emp.employeeNumber}</td>
                    <td className="p-3 text-muted-foreground">
                      {emp.firstName} {emp.lastName}
                    </td>
                    <td className="p-3 text-muted-foreground">{emp.department?.name ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{emp.jobTitle ?? "—"}</td>
                    <td className="p-3">
                      <Badge variant={emp.status === "ACTIVE" ? "default" : "outline"}>{emp.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      {canWrite && emp.status !== "TERMINATED" && (
                        <Button type="button" size="sm" variant="outline" onClick={() => handleTerminate(emp.id)}>
                          Terminate
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
