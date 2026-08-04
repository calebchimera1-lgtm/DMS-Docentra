"use client";

import { useEffect, useState } from "react";
import { Download, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input, Pagination } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv } from "../../../../lib/format";
import type { CalculationType, Paginated, SalaryComponent, SalaryComponentType } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { PayrollSubnav } from "../../../../components/payroll/payroll-subnav";

const TYPES: SalaryComponentType[] = ["EARNING", "DEDUCTION"];
const CALC_TYPES: CalculationType[] = ["FIXED", "PERCENTAGE"];

export default function SalaryComponentsPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.PAYROLL_WRITE) ?? false;

  const [result, setResult] = useState<Paginated<SalaryComponent> | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<SalaryComponentType>("EARNING");
  const [calculationType, setCalculationType] = useState<CalculationType>("FIXED");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    const qs = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (search) qs.set("search", search);
    void apiClient.get<Paginated<SalaryComponent>>(`/payroll/salary-components?${qs}`).then(setResult);
  };

  useEffect(load, [search, page]);
  useEffect(() => setPage(1), [search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // Dollars -> cents for FIXED, percent -> basis points for PERCENTAGE — both a *100 scale.
      const scaledValue = Math.round(parseFloat(value || "0") * 100);
      await apiClient.post("/payroll/salary-components", { name, code, type, calculationType, value: scaledValue });
      setName("");
      setCode("");
      setValue("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create salary component");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/payroll/salary-components/export");
    downloadCsv(csv, "salary-components.csv");
  }

  function formatValue(component: SalaryComponent): string {
    if (component.calculationType === "PERCENTAGE") {
      return `${(component.value / 100).toFixed(2)}%`;
    }
    return `$${(component.value / 100).toFixed(2)}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Payroll</h1>
        <p className="text-sm text-muted-foreground">Salary components, pay runs, and payslips.</p>
      </div>

      <PayrollSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Search components…"
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
              New component
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-5">
              <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input placeholder="Code (e.g. TAX)" value={code} onChange={(e) => setCode(e.target.value)} required />
              <select
                value={type}
                onChange={(e) => setType(e.target.value as SalaryComponentType)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                value={calculationType}
                onChange={(e) => setCalculationType(e.target.value as CalculationType)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                {CALC_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                step="0.01"
                placeholder={calculationType === "PERCENTAGE" ? "e.g. 10 for 10%" : "Amount"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
              />
              <Button type="submit" disabled={submitting} className="sm:col-start-5">
                {submitting ? "Creating…" : "Create component"}
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
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 font-medium">Value</th>
                <th className="p-3 font-medium">Status</th>
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
                    No salary components yet.
                  </td>
                </tr>
              ) : (
                result.items.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">{c.code}</td>
                    <td className="p-3 text-muted-foreground">{c.name}</td>
                    <td className="p-3">
                      <Badge variant={c.type === "EARNING" ? "default" : "outline"}>{c.type}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">{formatValue(c)}</td>
                    <td className="p-3">
                      <Badge variant={c.isActive ? "default" : "outline"}>{c.isActive ? "Active" : "Inactive"}</Badge>
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
