"use client";

import { useEffect, useState } from "react";
import { Bell, Building2, UserCheck, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { apiClient } from "../../../lib/api-client";
import type { ActivityByAction, AuditLogEntry, DashboardSummary } from "../../../lib/types";
import { useAuth } from "../../../providers/auth-provider";
import { ActivityBarChart } from "../../../components/activity-bar-chart";
import { RecentActivityFeed } from "../../../components/recent-activity-feed";
import { StatTile } from "../../../components/stat-tile";

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [activity, setActivity] = useState<ActivityByAction[] | null>(null);
  const [recent, setRecent] = useState<AuditLogEntry[] | null>(null);
  const [canSeeAuditLogs, setCanSeeAuditLogs] = useState(true);

  useEffect(() => {
    void apiClient.get<DashboardSummary>("/dashboard/summary").then(setSummary);

    Promise.all([
      apiClient.get<ActivityByAction[]>("/dashboard/activity-by-action"),
      apiClient.get<AuditLogEntry[]>("/dashboard/recent-activity?limit=8"),
    ])
      .then(([activityByAction, recentActivity]) => {
        setActivity(activityByAction);
        setRecent(recentActivity);
      })
      .catch(() => setCanSeeAuditLogs(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome back{user ? `, ${user.firstName}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s happening across your company.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active users" value={summary?.activeUserCount ?? "—"} icon={UserCheck} />
        <StatTile label="Total users" value={summary?.totalUserCount ?? "—"} icon={Users} />
        <StatTile label="Branches" value={summary?.branchCount ?? "—"} icon={Building2} />
        <StatTile label="Unread notifications" value={summary?.unreadNotificationCount ?? "—"} icon={Bell} />
      </div>

      {canSeeAuditLogs && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Activity by action, last 30 days</CardTitle>
            </CardHeader>
            <CardContent>
              {activity ? (
                <ActivityBarChart data={activity} />
              ) : (
                <p className="text-sm text-muted-foreground">Loading…</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recent ? (
                <RecentActivityFeed entries={recent} />
              ) : (
                <p className="text-sm text-muted-foreground">Loading…</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
