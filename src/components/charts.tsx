/**
 * Small dependency-free charts. A charting library would add ~100kB to a
 * page that renders two series; these are plain SVG and theme-aware.
 */

export function BarChart({
  data,
  formatValue,
}: {
  data: Array<{ label: string; value: number }>;
  formatValue: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    // items-stretch (the default) is load-bearing: with items-end the columns
    // size to content, leaving the inner flex-1 no height for the bars to fill.
    <div className="flex h-48 gap-2">
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
            <span className="text-[10px] tabular-nums text-ink-400">
              {formatValue(d.value)}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t bg-volt-500/80 transition-all"
                style={{ height: `${Math.max(2, pct)}%` }}
                role="img"
                aria-label={`${d.label}: ${formatValue(d.value)}`}
              />
            </div>
            <span className="text-[10px] text-ink-400">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function FunnelBar({
  stages,
}: {
  stages: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(1, ...stages.map((s) => s.value));

  return (
    <div className="space-y-2.5">
      {stages.map((stage, i) => {
        const pct = (stage.value / max) * 100;
        const prev = i > 0 ? stages[i - 1].value : null;
        const conversion = prev && prev > 0 ? (stage.value / prev) * 100 : null;

        return (
          <div key={stage.label}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="text-ink-300">{stage.label}</span>
              <span className="tabular-nums text-ink-400">
                {stage.value.toLocaleString()}
                {conversion !== null ? (
                  <span className="ml-2 text-volt-500">{conversion.toFixed(1)}%</span>
                ) : null}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink-800">
              <div
                className="h-full rounded-full bg-volt-500"
                style={{ width: `${Math.max(1, pct)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
