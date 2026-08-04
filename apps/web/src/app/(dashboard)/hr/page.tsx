"use client";

import { useEffect, useState } from "react";
import { Building2, Palmtree, UserCheck, Users, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { apiClient } from "../../../lib/api-client";
import type { DepartmentHeadcount, HrSummary } from "../../../lib/types";
import { HrSubnav } from "../../../components/hr/hr-subnav";
import { StageBarChart } from "../../../components/crm/stage-bar-chart";
import { StatTile } from "../../../components/stat-tile";

export default function HrOverviewPage() {
  const [summary, setSummary] = useState<HrSummary | null>(null);
  const [headcount, setHeadcount] = useState<DepartmentHeadcount[] | null>(null);

  useEffect(() => {
    void apiClient.get<HrSummary>("/hr/reports/summary").then(setSummary);
    void apiClient.get<DepartmentHeadcount[]>("/hr/reports/headcount-by-department").then(setHeadcount);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">HR</h1>
        <p className="text-sm text-muted-foreground">Departments, employees, and leave requests.</p>
      </div>

      <HrSubnav />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Active employees" value={summary?.activeEmployeeCount ?? "—"} icon={UserCheck} />
        <StatTile label="Total employees" value={summary?.totalEmployeeCount ?? "—"} icon={Users} />
        <StatTile label="On leave" value={summary?.onLeaveCount ?? "—"} icon={Palmtree} />
        <StatTile label="Departments" value={summary?.departmentCount ?? "—"} icon={Building2} />
        <StatTile label="Pending requests" value={summary?.pendingLeaveRequestCount ?? "—"} icon={UsersRound} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Headcount by department</CardTitle>
        </CardHeader>
        <CardContent>
          {headcount ? (
            <StageBarChart
              ariaLabel="Active headcount by department"
              data={headcount.map((d) => ({
                label: d.departmentName,
                value: d.employeeCount,
                displayValue: String(d.employeeCount),
              }))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
