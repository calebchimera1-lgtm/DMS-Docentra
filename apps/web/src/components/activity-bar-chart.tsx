import type { ActivityByAction } from "../lib/types";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Create",
  UPDATE: "Update",
  DELETE: "Delete",
  LOGIN: "Login",
  LOGIN_FAILED: "Failed login",
  LOGOUT: "Logout",
  PASSWORD_RESET: "Password reset",
  PERMISSION_CHANGE: "Permission change",
  EXPORT: "Export",
  OTHER: "Other",
};

/**
 * A single-series horizontal bar chart — no legend needed (the card title
 * names the series). Bars are capped at 24px, 4px rounded at the data end,
 * value labeled at the tip per the mark spec; gridline is a recessive
 * hairline. See the dataviz skill for the full rationale.
 */
export function ActivityBarChart({ data }: { data: ActivityByAction[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity in this period yet.</p>;
  }

  const max = Math.max(...data.map((d) => d.count));

  return (
    <div className="flex flex-col gap-3" role="img" aria-label="Audit log activity by action, last 30 days">
      {data.map((row) => {
        const widthPct = max > 0 ? Math.max((row.count / max) * 100, 4) : 0;
        return (
          <div key={row.action} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-sm text-muted-foreground">
              {ACTION_LABELS[row.action] ?? row.action}
            </span>
            <div
              className="h-4 flex-1 rounded-sm"
              style={{ backgroundColor: "var(--chart-gridline)" }}
              title={`${ACTION_LABELS[row.action] ?? row.action}: ${row.count}`}
            >
              <div
                className="h-4 rounded-[4px]"
                style={{ width: `${widthPct}%`, backgroundColor: "var(--chart-series-1)" }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-sm font-medium text-foreground">{row.count}</span>
          </div>
        );
      })}
    </div>
  );
}
