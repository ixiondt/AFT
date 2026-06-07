import type { WeightLogEntry } from "@/lib/aft/weight-service";
import { deleteWeightAction, logWeightAction } from "./weight-actions";

const CHART_W = 600;
const CHART_H = 120;
const CHART_PAD_X = 20;
const CHART_PAD_Y = 14;

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function WeightTracker({
  entries,
  currentWeightLb,
  goalWeightLb,
}: {
  entries: readonly WeightLogEntry[];
  currentWeightLb?: number;
  goalWeightLb?: number;
}) {
  const points = entries.map((e) => ({
    t: Date.parse(e.recordedAt),
    w: e.weightLb,
    entry: e,
  }));
  const latest = entries[entries.length - 1];
  const earliest = entries[0];

  const delta =
    latest && earliest && latest.id !== earliest.id
      ? latest.weightLb - earliest.weightLb
      : 0;

  return (
    <section className="print:hidden">
      <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
        Weight log
      </h2>

      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-[1fr_minmax(220px,260px)]">
        <div className="rounded-lg border border-[var(--color-line)] bg-white p-4">
          {points.length >= 2 ? (
            <Sparkline points={points} goalLb={goalWeightLb} />
          ) : (
            <div className="grid h-[120px] place-items-center text-sm text-[var(--color-ink-3)]">
              Log at least two weigh-ins to see the trend.
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
            {latest && (
              <span>
                <span className="text-[var(--color-ink-3)]">Latest:</span>{" "}
                <span className="font-mono">{latest.weightLb} lb</span>{" "}
                <span className="text-xs text-[var(--color-ink-3)]">
                  ({shortDate(latest.recordedAt)})
                </span>
              </span>
            )}
            {delta !== 0 && (
              <span>
                <span className="text-[var(--color-ink-3)]">Change:</span>{" "}
                <span
                  className={
                    delta < 0
                      ? "font-mono text-[var(--color-accent)]"
                      : "font-mono text-[var(--color-ink)]"
                  }
                >
                  {delta > 0 ? "+" : ""}
                  {delta} lb
                </span>
              </span>
            )}
            {goalWeightLb && (
              <span>
                <span className="text-[var(--color-ink-3)]">Goal:</span>{" "}
                <span className="font-mono">{goalWeightLb} lb</span>
              </span>
            )}
          </div>
        </div>

        <form action={logWeightAction} className="space-y-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-2)] p-4">
          <label className="block">
            <span className="block text-sm font-medium text-[var(--color-ink-2)]">
              Today's weight (lb)
            </span>
            <input
              name="weightLb"
              type="number"
              min={60}
              max={600}
              required
              defaultValue={currentWeightLb ?? ""}
              className="mt-1 block w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--color-accent)] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-[var(--color-ink-2)]">
              Notes (optional)
            </span>
            <input
              name="notes"
              type="text"
              maxLength={200}
              placeholder="post-run, fasted, etc."
              className="mt-1 block w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--color-accent)] focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-accent-fg)] hover:opacity-90"
          >
            Log
          </button>
        </form>
      </div>

      {entries.length > 0 && (
        <details className="mt-4 rounded-lg border border-[var(--color-line)] bg-white">
          <summary className="cursor-pointer px-4 py-2 text-sm text-[var(--color-ink-2)]">
            All entries ({entries.length})
          </summary>
          <ul className="divide-y divide-[var(--color-line)] text-sm">
            {[...entries].reverse().map((e) => (
              <li key={e.id} className="flex items-center justify-between px-4 py-2">
                <div>
                  <span className="font-mono">{e.weightLb} lb</span>{" "}
                  <span className="text-xs text-[var(--color-ink-3)]">
                    {shortDate(e.recordedAt)}
                  </span>
                  {e.notes && (
                    <span className="ml-2 text-xs italic text-[var(--color-ink-3)]">
                      {e.notes}
                    </span>
                  )}
                </div>
                <form action={deleteWeightAction}>
                  <input type="hidden" name="entryId" value={e.id} />
                  <button
                    type="submit"
                    className="text-xs text-[var(--color-ink-3)] hover:text-[var(--color-danger)]"
                  >
                    delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function Sparkline({
  points,
  goalLb,
}: {
  points: ReadonlyArray<{ t: number; w: number }>;
  goalLb?: number;
}) {
  const minT = points[0]!.t;
  const maxT = points[points.length - 1]!.t;
  const weights = points.map((p) => p.w);
  if (goalLb) weights.push(goalLb);
  const minW = Math.min(...weights) - 1;
  const maxW = Math.max(...weights) + 1;

  const xRange = Math.max(1, maxT - minT);
  const yRange = Math.max(1, maxW - minW);
  const xScale = (t: number) =>
    CHART_PAD_X + ((t - minT) / xRange) * (CHART_W - 2 * CHART_PAD_X);
  const yScale = (w: number) =>
    CHART_H - CHART_PAD_Y - ((w - minW) / yRange) * (CHART_H - 2 * CHART_PAD_Y);

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.t).toFixed(1)} ${yScale(p.w).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      preserveAspectRatio="none"
      className="h-[120px] w-full"
      role="img"
      aria-label="weight trend"
    >
      {goalLb && (
        <line
          x1={CHART_PAD_X}
          x2={CHART_W - CHART_PAD_X}
          y1={yScale(goalLb)}
          y2={yScale(goalLb)}
          stroke="var(--color-accent)"
          strokeDasharray="4 4"
          strokeWidth="1"
        />
      )}
      <path d={path} fill="none" stroke="var(--color-ink-2)" strokeWidth="2" />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={xScale(p.t)}
          cy={yScale(p.w)}
          r="3"
          fill="var(--color-ink)"
        />
      ))}
      <text
        x={CHART_PAD_X}
        y={CHART_H - 2}
        fontSize="10"
        fill="var(--color-ink-3)"
      >
        {new Date(minT).toLocaleDateString()}
      </text>
      <text
        x={CHART_W - CHART_PAD_X}
        y={CHART_H - 2}
        fontSize="10"
        textAnchor="end"
        fill="var(--color-ink-3)"
      >
        {new Date(maxT).toLocaleDateString()}
      </text>
    </svg>
  );
}
