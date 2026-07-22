export interface StageBarDatum {
  label: string;
  value: number;
  displayValue: string;
}

/**
 * Horizontal single-series bar chart, same mark spec as the dashboard's
 * ActivityBarChart (24px cap via h-4/h-6, 4px rounded end, hairline
 * gridline track) — reused here for CRM pipeline/funnel breakdowns so all
 * charts in the app read as one system.
 */
export function StageBarChart({ data, ariaLabel }: { data: StageBarDatum[]; ariaLabel: string }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No data yet.</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex flex-col gap-3" role="img" aria-label={ariaLabel}>
      {data.map((row) => {
        const widthPct = row.value > 0 ? Math.max((row.value / max) * 100, 4) : 0;
        return (
          <div key={row.label} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-sm text-muted-foreground">{row.label}</span>
            <div
              className="h-4 flex-1 rounded-sm"
              style={{ backgroundColor: "var(--chart-gridline)" }}
              title={`${row.label}: ${row.displayValue}`}
            >
              <div
                className="h-4 rounded-[4px]"
                style={{ width: `${widthPct}%`, backgroundColor: "var(--chart-series-1)" }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-sm font-medium text-foreground">
              {row.displayValue}
            </span>
          </div>
        );
      })}
    </div>
  );
}
