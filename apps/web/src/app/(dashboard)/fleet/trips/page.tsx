"use client";

import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input, Pagination } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv } from "../../../../lib/format";
import type { Paginated, Trip, TripStatus, Vehicle } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { FleetSubnav } from "../../../../components/fleet/fleet-subnav";

export default function TripsPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.FLEET_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<Trip> | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [statusFilter, setStatusFilter] = useState<TripStatus | "">("");
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [endOdometer, setEndOdometer] = useState("");

  const load = () => {
    const qs = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (statusFilter) qs.set("status", statusFilter);
    void apiClient.get<Paginated<Trip>>(`/fleet/trips?${qs}`).then(setResult);
  };

  useEffect(load, [statusFilter, page]);
  useEffect(() => setPage(1), [statusFilter]);
  useEffect(() => {
    void apiClient
      .get<Paginated<Vehicle>>("/fleet/vehicles?page=1&pageSize=100&status=ACTIVE")
      .then((r) => setVehicles(r.items));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/fleet/trips", { vehicleId, purpose: purpose || undefined });
      setVehicleId("");
      setPurpose("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start trip");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComplete(id: string) {
    setActionError(null);
    try {
      await apiClient.post(`/fleet/trips/${id}/complete`, { endOdometer: parseInt(endOdometer, 10) || 0 });
      setCompletingId(null);
      setEndOdometer("");
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to complete trip");
    }
  }

  async function handleCancel(id: string) {
    setActionError(null);
    try {
      await apiClient.post(`/fleet/trips/${id}/cancel`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to cancel trip");
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/fleet/trips/export");
    downloadCsv(csv, "trips.csv");
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
          onChange={(e) => setStatusFilter(e.target.value as TripStatus | "")}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
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
              Start trip
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
              <Input placeholder="Purpose (optional)" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
              <Button type="submit" disabled={submitting}>
                {submitting ? "Starting…" : "Start trip"}
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
                <th className="p-3 font-medium">Driver</th>
                <th className="p-3 font-medium">Purpose</th>
                <th className="p-3 font-medium">Start odometer</th>
                <th className="p-3 font-medium">Distance</th>
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
                    No trips yet.
                  </td>
                </tr>
              ) : (
                result.items.map((trip) => (
                  <tr key={trip.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">{trip.vehicle.registrationNumber}</td>
                    <td className="p-3 text-muted-foreground">
                      {trip.driver ? `${trip.driver.firstName} ${trip.driver.lastName}` : "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">{trip.purpose ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{trip.startOdometer}</td>
                    <td className="p-3 text-muted-foreground">{trip.distance ?? "—"}</td>
                    <td className="p-3">
                      <Badge variant={trip.status === "COMPLETED" ? "default" : "outline"}>{trip.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      {canWrite && trip.status === "IN_PROGRESS" && (
                        <div className="flex justify-end gap-2">
                          {completingId === trip.id ? (
                            <>
                              <Input
                                type="number"
                                min={trip.startOdometer}
                                placeholder="End odometer"
                                value={endOdometer}
                                onChange={(e) => setEndOdometer(e.target.value)}
                                className="h-9 w-32"
                              />
                              <Button type="button" size="sm" onClick={() => handleComplete(trip.id)}>
                                Confirm
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => setCompletingId(null)}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button type="button" size="sm" onClick={() => setCompletingId(trip.id)}>
                                Complete
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => handleCancel(trip.id)}>
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
