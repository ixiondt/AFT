import type { WeeklyPoint } from "@/lib/aft/progress-service";
import { secToMmss } from "@/lib/scoring";

const CHART_W = 400;
const CHART_H = 80;
const PAD = 8;

type ValueFmt = "lb" | "reps" | "mmss" | "ratio" | "rpe";

function formatValue(v: number, fmt: ValueFmt): string {
  if (fmt === "lb") return `${Math.round(v)} lb`;
  if (fmt === "reps") return `${Math.round(v)} reps`;
  if (fmt === "mmss") return secToMmss(Math.round(v));
  if (fmt === "ratio") return `${Math.round(v * 100)}%`;
  if (fmt === "rpe") return v.toFixed(1);
  return String(v);
}

export function WeeklyChartCard({
  title,
  data,
  fmt,
  target,
  empty,
}: {
  title: string;
  data: readonly WeeklyPoint[];
  fmt: ValueFmt;
  target?: number;
  empty: string;
}) {
  const points = data
    .map((p) => ({ x: p.weekIndex, y: p.value }))
    .filter((p): p is { x: number; y: number } => p.y !== null);

  const latest = points[points.length - 1];
  const trend = computeTrend(points);

  return (
    <section className="rounded-lg border border-[var(--color-line)] bg-white p-4">
      <header className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">{title}</h3>
        {latest ? (
          <div className="text-right">
            <div className="font-mono text-base text-[var(--color-ink)]">
              {formatValue(latest.y, fmt)}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
              wk {latest.x + 1}
              {trend !== null && (
                <span
                  className={
                    trend > 0
                      ? "ml-2 text-[var(--color-accent)]"
                      : trend < 0
                        ? "ml-2 text-[var(--color-danger)]"
                        : ""
                  }
                >
                  {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"}
                </span>
              )}
            </div>
          </div>
        ) : (
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
            no data yet
          </span>
        )}
      </header>

      <div className="mt-3">
        {points.length >= 1 ? (
          <LineChart
            points={points}
            target={target}
            maxWeek={data.length > 0 ? data[data.length - 1]!.weekIndex : 0}
          />
        ) : (
          <div className="grid h-[80px] place-items-center text-xs text-[var(--color-ink-3)]">
            {empty}
          </div>
        )}
      </div>

      {target !== undefined && (
        <div className="mt-1 text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
          goal {formatValue(target, fmt)}
        </div>
      )}
    </section>
  );
}

function LineChart({
  points,
  target,
  maxWeek,
}: {
  points: ReadonlyArray<{ x: number; y: number }>;
  target?: number;
  maxWeek: number;
}) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  if (target !== undefined) ys.push(target);

  const minY = Math.min(...ys) * 0.95;
  const maxY = Math.max(...ys) * 1.05;
  const minX = 0;
  const xRange = Math.max(1, maxWeek);
  const yRange = Math.max(0.001, maxY - minY);

  const xScale = (x: number) => PAD + ((x - minX) / xRange) * (CHART_W - 2 * PAD);
  const yScale = (y: number) =>
    CHART_H - PAD - ((y - minY) / yRange) * (CHART_H - 2 * PAD);

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.x).toFixed(1)} ${yScale(p.y).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      preserveAspectRatio="none"
      className="h-[80px] w-full"
      role="img"
    >
      {target !== undefined && (
        <line
          x1={PAD}
          x2={CHART_W - PAD}
          y1={yScale(target)}
          y2={yScale(target)}
          stroke="var(--color-accent)"
          strokeDasharray="4 4"
          strokeWidth="1"
        />
      )}
      <path d={path} fill="none" stroke="var(--color-ink-2)" strokeWidth="2" />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={xScale(p.x)}
          cy={yScale(p.y)}
          r="3"
          fill="var(--color-ink)"
        />
      ))}
    </svg>
  );
}

function computeTrend(points: ReadonlyArray<{ x: number; y: number }>): number | null {
  if (points.length < 2) return null;
  return points[points.length - 1]!.y - points[0]!.y;
}

export function CompletionCard({
  data,
}: {
  data: ReadonlyArray<{ weekIndex: number; prescribed: number; completed: number }>;
}) {
  const totalPrescribed = data.reduce((a, w) => a + w.prescribed, 0);
  const totalCompleted = data.reduce((a, w) => a + w.completed, 0);
  const overall = totalPrescribed > 0 ? totalCompleted / totalPrescribed : 0;

  return (
    <section className="rounded-lg border border-[var(--color-line)] bg-white p-4">
      <header className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">Adherence</h3>
        <div className="text-right">
          <div className="font-mono text-base text-[var(--color-ink)]">
            {Math.round(overall * 100)}%
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
            {totalCompleted} of {totalPrescribed} done
          </div>
        </div>
      </header>
      <div className="mt-3 flex h-[80px] items-end gap-1">
        {data.map((w) => {
          const ratio = w.prescribed > 0 ? w.completed / w.prescribed : 0;
          const heightPct = Math.max(2, Math.round(ratio * 100));
          return (
            <div
              key={w.weekIndex}
              title={`Wk ${w.weekIndex + 1}: ${w.completed} / ${w.prescribed}`}
              className="flex-1 rounded-sm"
              style={{
                height: `${heightPct}%`,
                background:
                  ratio >= 0.8
                    ? "var(--color-accent)"
                    : ratio >= 0.5
                      ? "oklch(0.7 0.09 145)"
                      : "var(--color-line)",
                printColorAdjust: "exact",
                WebkitPrintColorAdjust: "exact",
              }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-[var(--color-ink-3)]">
        <span>Wk 1</span>
        <span>Wk {data.length}</span>
      </div>
    </section>
  );
}
