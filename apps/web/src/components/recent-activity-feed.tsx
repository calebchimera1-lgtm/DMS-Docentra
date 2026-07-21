import { Activity } from "lucide-react";
import type { AuditLogEntry } from "../lib/types";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "created",
  UPDATE: "updated",
  DELETE: "deleted",
  LOGIN: "logged in",
  LOGIN_FAILED: "had a failed login attempt",
  LOGOUT: "logged out",
  PASSWORD_RESET: "reset their password",
  PERMISSION_CHANGE: "changed a permission",
  EXPORT: "exported data",
  OTHER: "performed an action",
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function RecentActivityFeed({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity recorded yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-foreground">
              <span className="font-medium">{entry.entityType}</span>{" "}
              {ACTION_LABELS[entry.action] ?? entry.action.toLowerCase()}
            </p>
            <p className="text-xs text-muted-foreground">{formatRelativeTime(entry.createdAt)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
