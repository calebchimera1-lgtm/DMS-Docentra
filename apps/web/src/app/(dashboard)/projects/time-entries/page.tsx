"use client";

import { useEffect, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv } from "../../../../lib/format";
import type { Paginated, ProjectTask, TimeEntry } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { ProjectsSubnav } from "../../../../components/projects/projects-subnav";

export default function TimeEntriesPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.PROJECTS_WRITE) ?? false;
  const canDelete = user?.effectivePermissions.includes(PERMISSIONS.PROJECTS_DELETE) ?? false;

  const [result, setResult] = useState<Paginated<TimeEntry> | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = () => {
    void apiClient.get<Paginated<TimeEntry>>("/projects/time-entries?page=1&pageSize=50").then(setResult);
  };

  useEffect(load, []);
  useEffect(() => {
    void apiClient.get<Paginated<ProjectTask>>("/projects/tasks?page=1&pageSize=100").then((r) => setTasks(r.items));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/projects/time-entries", {
        taskId,
        minutes: Number(minutes),
        entryDate,
        note: note || undefined,
      });
      setNote("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to log time");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setActionError(null);
    try {
      await apiClient.delete(`/projects/time-entries/${id}`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete time entry");
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/projects/time-entries/export");
    downloadCsv(csv, "time-entries.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Projects</h1>
        <p className="text-sm text-muted-foreground">Projects, tasks, and logged time.</p>
      </div>

      <ProjectsSubnav />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-1 h-3.5 w-3.5" />
          Export CSV
        </Button>
        {canWrite && (
          <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Log time
          </Button>
        )}
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <select
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                required
              >
                <option value="">Select task…</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.project.code} — {t.title}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min={1}
                max={1440}
                placeholder="Minutes"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                required
              />
              <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
              <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button type="submit" disabled={submitting} className="sm:col-start-4">
                {submitting ? "Logging…" : "Log time"}
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
                <th className="p-3 font-medium">Task</th>
                <th className="p-3 font-medium">User</th>
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Minutes</th>
                <th className="p-3 font-medium">Billable</th>
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
                    No time entries yet.
                  </td>
                </tr>
              ) : (
                result.items.map((te) => (
                  <tr key={te.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">
                      {te.task.project.code} — {te.task.title}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {te.user.firstName} {te.user.lastName}
                    </td>
                    <td className="p-3 text-muted-foreground">{new Date(te.entryDate).toLocaleDateString()}</td>
                    <td className="p-3 text-muted-foreground">{te.minutes}</td>
                    <td className="p-3">
                      <Badge variant={te.billable ? "default" : "outline"}>{te.billable ? "Billable" : "No"}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      {canDelete && te.user.id === user?.id && (
                        <Button type="button" size="sm" variant="outline" onClick={() => handleDelete(te.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
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
