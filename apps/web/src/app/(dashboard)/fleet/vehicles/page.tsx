"use client";

import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv } from "../../../../lib/format";
import type { Employee, Paginated, Vehicle, VehicleStatus } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { FleetSubnav } from "../../../../components/fleet/fleet-subnav";

export default function VehiclesPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.FLEET_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<Vehicle> | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | "">("");
  const [search, setSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [odometerReading, setOdometerReading] = useState("0");
  const [fuelType, setFuelType] = useState("");
  const [assignedDriverId, setAssignedDriverId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = () => {
    const qs = new URLSearchParams({ page: "1", pageSize: "50" });
    if (statusFilter) qs.set("status", statusFilter);
    if (search) qs.set("search", search);
    void apiClient.get<Paginated<Vehicle>>(`/fleet/vehicles?${qs}`).then(setResult);
  };

  useEffect(load, [statusFilter, search]);
  useEffect(() => {
    void apiClient.get<Paginated<Employee>>("/hr/employees?page=1&pageSize=100").then((r) => setEmployees(r.items));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/fleet/vehicles", {
        registrationNumber,
        make,
        model,
        year: year ? parseInt(year, 10) : undefined,
        odometerReading: odometerReading ? parseInt(odometerReading, 10) : 0,
        fuelType: fuelType || undefined,
        assignedDriverId: assignedDriverId || undefined,
      });
      setRegistrationNumber("");
      setMake("");
      setModel("");
      setYear("");
      setOdometerReading("0");
      setFuelType("");
      setAssignedDriverId("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create vehicle");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(id: string, action: "retire" | "reactivate") {
    setActionError(null);
    try {
      await apiClient.post(`/fleet/vehicles/${id}/${action}`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : `Failed to ${action} vehicle`);
    }
  }

  async function handleDelete(id: string) {
    setActionError(null);
    try {
      await apiClient.delete(`/fleet/vehicles/${id}`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete vehicle");
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/fleet/vehicles/export");
    downloadCsv(csv, "vehicles.csv");
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
        <div className="flex gap-2">
          <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as VehicleStatus | "")}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="IN_MAINTENANCE">In maintenance</option>
            <option value="RETIRED">Retired</option>
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
              New vehicle
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Input
                placeholder="Registration number"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                required
              />
              <Input placeholder="Make" value={make} onChange={(e) => setMake(e.target.value)} required />
              <Input placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} required />
              <Input type="number" placeholder="Year" value={year} onChange={(e) => setYear(e.target.value)} />
              <Input
                type="number"
                min="0"
                placeholder="Odometer reading"
                value={odometerReading}
                onChange={(e) => setOdometerReading(e.target.value)}
              />
              <Input placeholder="Fuel type" value={fuelType} onChange={(e) => setFuelType(e.target.value)} />
              <select
                value={assignedDriverId}
                onChange={(e) => setAssignedDriverId(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">Assigned driver (optional)…</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>
              <Button type="submit" disabled={submitting} className="sm:col-start-4">
                {submitting ? "Creating…" : "Create vehicle"}
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
                <th className="p-3 font-medium">Registration</th>
                <th className="p-3 font-medium">Make / Model</th>
                <th className="p-3 font-medium">Odometer</th>
                <th className="p-3 font-medium">Driver</th>
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
                    No vehicles yet.
                  </td>
                </tr>
              ) : (
                result.items.map((v) => (
                  <tr key={v.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">{v.registrationNumber}</td>
                    <td className="p-3 text-muted-foreground">
                      {v.make} {v.model}
                      {v.year ? ` (${v.year})` : ""}
                    </td>
                    <td className="p-3 text-muted-foreground">{v.odometerReading}</td>
                    <td className="p-3 text-muted-foreground">
                      {v.assignedDriver ? `${v.assignedDriver.firstName} ${v.assignedDriver.lastName}` : "—"}
                    </td>
                    <td className="p-3">
                      <Badge variant={v.status === "ACTIVE" ? "default" : "outline"}>{v.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      {canWrite && (
                        <div className="flex justify-end gap-2">
                          {v.status === "ACTIVE" && (
                            <Button type="button" size="sm" variant="outline" onClick={() => handleAction(v.id, "retire")}>
                              Retire
                            </Button>
                          )}
                          {v.status === "RETIRED" && (
                            <>
                              <Button type="button" size="sm" onClick={() => handleAction(v.id, "reactivate")}>
                                Reactivate
                              </Button>
                              <Button type="button" size="sm" variant="destructive" onClick={() => handleDelete(v.id)}>
                                Delete
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
        </CardContent>
      </Card>
    </div>
  );
}
