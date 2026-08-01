"use client";

import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input, Pagination } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv } from "../../../../lib/format";
import type { MaintenanceRecord, MaintenanceStatus, MaintenanceType, Paginated, Vehicle } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { FleetSubnav } from "../../../../components/fleet/fleet-subnav";

export default function MaintenancePage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.FLEET_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<MaintenanceRecord> | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [statusFilter, setStatusFilter] = useState<MaintenanceStatus | "">("");
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [type, setType] = useState<MaintenanceType>("SERVICE");
  const [scheduledDate, setScheduledDate] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [costCents, setCostCents] = useState("");

  const load = () => {
    const qs = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (statusFilter) qs.set("status", statusFilter);
    void apiClient.get<Paginated<MaintenanceRecord>>(`/fleet/maintenance?${qs}`).then(setResult);
  };

  useEffect(load, [statusFilter, page]);
  useEffect(() => setPage(1), [statusFilter]);
  useEffect(() => {
    void apiClient.get<Paginated<Vehicle>>("/fleet/vehicles?page=1&pageSize=100").then((r) => setVehicles(r.items));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/fleet/maintenance", {
        vehicleId,
        type,
        scheduledDate,
        description: description || undefined,
      });
      setVehicleId("");
      setType("SERVICE");
      setScheduledDate("");
      setDescription("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to schedule maintenance");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStart(id: string) {
    setActionError(null);
    try {
      await apiClient.post(`/fleet/maintenance/${id}/start`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to start maintenance");
    }
  }

  async function handleComplete(id: string) {
    setActionError(null);
    try {
      await apiClient.post(`/fleet/maintenance/${id}/complete`, {
        costCents: costCents ? parseInt(costCents, 10) : undefined,
      });
      setCompletingId(null);
      setCostCents("");
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to complete maintenance");
    }
  }

  async function handleCancel(id: string) {
    setActionError(null);
    try {
      await apiClient.post(`/fleet/maintenance/${id}/cancel`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to cancel maintenance");
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/fleet/maintenance/export");
    downloadCsv(csv, "maintenance.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Fleet Management</h1>
        <p className="text-sm text-muted-foreground">
          Vehicles, trips, and maintenance jobs that keep the fleet running.
        </p>
      </div>

      <FleetSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as MaintenanceStatus | "")}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
          {canWrite && (
            <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Schedule maintenance
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                required
              >
                <option value="">Vehicle…</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registrationNumber} ({v.make} {v.model})
                  </option>
                ))}
              </select>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as MaintenanceType)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="SERVICE">Service</option>
                <option value="REPAIR">Repair</option>
                <option value="INSPECTION">Inspection</option>
              </select>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
              />
              <Input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
              <Button type="submit" disabled={submitting} className="sm:col-start-4">
                {submitting ? "Scheduling…" : "Schedule"}
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
                <th className="p-3 font-medium">Vehicle</th>
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 font-medium">Scheduled date</th>
                <th className="p-3 font-medium">Cost</th>
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
                    No maintenance jobs yet.
                  </td>
                </tr>
              ) : (
                result.items.map((rec) => (
                  <tr key={rec.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">{rec.vehicle.registrationNumber}</td>
                    <td className="p-3 text-muted-foreground">{rec.type}</td>
                    <td className="p-3 text-muted-foreground">{new Date(rec.scheduledDate).toLocaleDateString()}</td>
                    <td className="p-3 text-muted-foreground">
                      {rec.costCents !== null ? `$${(rec.costCents / 100).toFixed(2)}` : "—"}
                    </td>
                    <td className="p-3">
                      <Badge variant={rec.status === "COMPLETED" ? "default" : "outline"}>{rec.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      {canWrite && rec.status === "SCHEDULED" && (
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" onClick={() => handleStart(rec.id)}>
                            Start
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => handleCancel(rec.id)}>
                            Cancel
                          </Button>
                        </div>
                      )}
                      {canWrite && rec.status === "IN_PROGRESS" && (
                        <div className="flex justify-end gap-2">
                          {completingId === rec.id ? (
                            <>
                              <Input
                                type="number"
                                min="0"
                                placeholder="Cost (cents)"
                                value={costCents}
                                onChange={(e) => setCostCents(e.target.value)}
                                className="h-9 w-32"
                              />
                              <Button type="button" size="sm" onClick={() => handleComplete(rec.id)}>
                                Confirm
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => setCompletingId(null)}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button type="button" size="sm" onClick={() => setCompletingId(rec.id)}>
                                Complete
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => handleCancel(rec.id)}>
                                Cancel
                              </Button>
                            </>
                          )}
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
