import { secToMmss } from "@/lib/scoring";
import type { BlockName, Plan, SessionPrescription, SessionType } from "@/lib/planner";
import type { WorkoutLog } from "@/lib/aft/workout-service";
import { WeekControls } from "./week-controls";
import { logWorkoutDetailsAction, markWorkoutAction } from "./workout-actions";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function PlanSummary({ plan }: { plan: Plan }) {
  return (
    <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-2)] p-6 print-keep">
      <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
        Summary
      </h2>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 text-[var(--color-ink)]">
        <div>
          <div className="text-xs text-[var(--color-ink-3)]">Current total</div>
          <div className="text-2xl font-semibold">{plan.currentTotal}</div>
        </div>
        <div className="text-2xl text-[var(--color-ink-3)]">→</div>
        <div>
          <div className="text-xs text-[var(--color-ink-3)]">Goal total</div>
          <div className="text-2xl font-semibold">{plan.goalTotal}</div>
        </div>
        <div className="ml-auto text-sm text-[var(--color-ink-2)]">
          Bracket <span className="font-mono">{plan.bracket}</span> · {plan.input.durationWeeks} weeks ·{" "}
          {plan.input.daysPerWeek} days/wk
        </div>
      </div>
    </section>
  );
}

export function GapTable({ plan }: { plan: Plan }) {
  return (
    <section className="print-keep">
      <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
        Where to gain points
      </h2>
      <table className="mt-3 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wider text-[var(--color-ink-3)]">
            <th className="py-2">Event</th>
            <th className="py-2">Current</th>
            <th className="py-2">Goal</th>
            <th className="py-2">Gap</th>
          </tr>
        </thead>
        <tbody>
          {plan.gaps.map((g) => (
            <tr key={g.event} className="border-b border-[var(--color-line)]">
              <td className="py-2 font-mono">{g.event}</td>
              <td className="py-2">{g.currentPoints} pts</td>
              <td className="py-2">{g.goalPoints} pts</td>
              <td className="py-2">
                {g.gap > 0 ? (
                  <span className="font-medium text-[var(--color-accent)]">+{g.gap}</span>
                ) : (
                  <span className="text-[var(--color-ink-3)]">maintain</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function BlockBar({ plan }: { plan: Plan }) {
  const totalWeeks = plan.input.durationWeeks;
  const palette: Record<string, string> = {
    Base: "oklch(0.82 0.06 145)",
    Build: "oklch(0.7 0.09 145)",
    Peak: "oklch(0.55 0.12 145)",
    Test: "oklch(0.42 0.16 25)",
  };
  return (
    <section className="print-keep">
      <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
        Block layout
      </h2>
      <div
        className="mt-3 flex h-7 w-full overflow-hidden rounded-md border border-[var(--color-line)]"
        style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      >
        {plan.blocks.map((b) => (
          <div
            key={b.name + b.startWeekIndex}
            style={{ width: `${(b.weeks / totalWeeks) * 100}%`, background: palette[b.name] }}
            className="flex items-center justify-center text-xs font-medium text-white"
          >
            {b.name} · {b.weeks}w
          </div>
        ))}
      </div>
    </section>
  );
}

export function PaceCard({ plan }: { plan: Plan }) {
  const { paces } = plan;
  return (
    <section className="print-keep">
      <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
        Run paces (VDOT {paces.vdot})
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <PaceRow label="Easy" value={`${secToMmss(paces.easyPerMileSec)}/mi`} />
        <PaceRow label="Marathon" value={`${secToMmss(paces.marathonPerMileSec)}/mi`} />
        <PaceRow label="Tempo" value={`${secToMmss(paces.tempoPerMileSec)}/mi`} />
        <PaceRow label="Interval" value={`${secToMmss(paces.intervalPerMileSec)}/mi`} />
        <PaceRow label="Repetition" value={`${secToMmss(paces.repetitionPerMileSec)}/mi`} />
        <PaceRow label="Goal 2MR pace" value={`${secToMmss(paces.goal2MRPaceSec)}/mi`} />
        <PaceRow label="400m" value={secToMmss(paces.pace400Sec)} />
        <PaceRow label="800m" value={secToMmss(paces.pace800Sec)} />
        <PaceRow label="1200m" value={secToMmss(paces.pace1200Sec)} />
      </dl>
    </section>
  );
}

function PaceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-dashed border-[var(--color-line)] pb-1">
      <dt className="text-[var(--color-ink-3)]">{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}

export function MdlLadderTable({ plan }: { plan: Plan }) {
  return (
    <section className="print-keep">
      <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
        Deadlift ladder
      </h2>
      <p className="mt-1 text-xs text-[var(--color-ink-3)]">
        Same-weight weeks show as <code className="font-mono">sets × reps × lb</code>.
        Test day's warm-up ladder is shown step-by-step, ending at the goal attempt.
      </p>
      <table className="mt-3 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wider text-[var(--color-ink-3)]">
            <th className="py-2">Wk</th>
            <th className="py-2">Block</th>
            <th className="py-2">Prescription</th>
            <th className="py-2">Top single</th>
          </tr>
        </thead>
        <tbody>
          {plan.mdlLadder.map((w) => (
            <tr key={w.weekIndex} className="border-b border-[var(--color-line)]">
              <td className="py-2 font-mono">{w.weekIndex + 1}</td>
              <td className="py-2">{w.block}</td>
              <td className="py-2 font-mono">{formatLadderSets(w.sets, w.block)}</td>
              <td className="py-2 font-mono">{w.topSingleLb ? `${w.topSingleLb} lb` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function formatLadderSets(
  sets: Plan["mdlLadder"][number]["sets"],
  block: Plan["mdlLadder"][number]["block"],
): string {
  if (sets.length === 0) return "—";
  const first = sets[0]!;
  const allSameWeight = sets.every((s) => s.weightLb === first.weightLb);
  const allSameReps = sets.every((s) => s.reps === first.reps);

  if (allSameWeight && allSameReps) {
    return `${sets.length} × ${first.reps} × ${first.weightLb} lb`;
  }
  // Differing-weight ladder (e.g. Test day warmup → attempt). Show step by step,
  // mark the final set as the attempt when we're in Test week.
  const parts = sets.map((s, i) => {
    const base = `${s.reps}×${s.weightLb}`;
    if (block === "Test" && i === sets.length - 1) return `${base}★`;
    return base;
  });
  return `${parts.join(" → ")} lb${block === "Test" ? "  (★ = goal attempt)" : ""}`;
}

export function CheckpointList({ plan }: { plan: Plan }) {
  return (
    <section className="print-keep">
      <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
        Checkpoints
      </h2>
      <div className="mt-3 space-y-3">
        {plan.checkpoints.map((c) => (
          <div
            key={c.label}
            className="rounded-md border border-[var(--color-line)] bg-white p-4 print-keep"
          >
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold text-[var(--color-ink)]">{c.label}</h3>
              <span className="font-mono text-xs text-[var(--color-ink-3)]">
                Week {c.weekIndex + 1}
              </span>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              {c.events.map((ev) => {
                const v = c.targets[ev];
                if (typeof v !== "number") return null;
                const disp = ev === "MDL" ? `${v} lb` : ev === "HRP" ? `${v} reps` : secToMmss(v);
                return (
                  <div key={ev} className="flex justify-between">
                    <dt className="font-mono text-[var(--color-ink-3)]">{ev}</dt>
                    <dd className="font-mono">{disp}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

const SESSION_BADGE: Record<SessionType, { short: string; bg: string; fg: string }> = {
  strength_a: { short: "SA", bg: "oklch(0.55 0.12 145)", fg: "white" },
  strength_b: { short: "SB", bg: "oklch(0.6 0.1 145)", fg: "white" },
  intervals: { short: "Int", bg: "oklch(0.55 0.16 25)", fg: "white" },
  tempo: { short: "Tmp", bg: "oklch(0.62 0.14 60)", fg: "white" },
  long: { short: "Long", bg: "oklch(0.7 0.09 145)", fg: "white" },
  aft_skills: { short: "Skl", bg: "oklch(0.55 0.1 270)", fg: "white" },
  sdc: { short: "SDC", bg: "oklch(0.5 0.14 270)", fg: "white" },
  recovery: { short: "Rec", bg: "oklch(0.92 0.005 250)", fg: "var(--color-ink-2)" },
  rest: { short: "Rst", bg: "oklch(0.96 0.003 250)", fg: "var(--color-ink-3)" },
};

function WeekStrip({ days }: { days: Plan["weeks"][number]["days"] }) {
  return (
    <div className="flex gap-1">
      {days.map((d) => {
        const badge = SESSION_BADGE[d.session.sessionType];
        return (
          <span
            key={d.dayOfWeek}
            title={`${DOW[d.dayOfWeek] ?? "?"} · ${d.session.title}`}
            style={{
              background: badge.bg,
              color: badge.fg,
              printColorAdjust: "exact",
              WebkitPrintColorAdjust: "exact",
            }}
            className="grid h-7 min-w-[3.25rem] flex-1 place-items-center rounded-md text-[10px] font-mono uppercase tracking-wider"
          >
            <span className="px-1">
              {DOW[d.dayOfWeek]?.[0] ?? "?"}·{badge.short}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export function WeeklyCalendar({
  plan,
  workouts,
}: {
  plan: Plan;
  workouts: Map<string, WorkoutLog>;
}) {
  const themes = plan.narrative?.weeklyThemes;
  // Open the first week by default; others collapsed.
  return (
    <section className="print-break-before">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
          Week-by-week
        </h2>
        <WeekControls />
      </div>

      <div className="mt-3 space-y-3">
        {plan.weeks.map((w) => (
          <details
            key={w.weekIndex}
            open={w.weekIndex === 0}
            className="aft-week group rounded-md border border-[var(--color-line)] bg-white print-keep open:shadow-sm"
          >
            <summary className="cursor-pointer list-none px-4 py-2 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="grid h-5 w-5 shrink-0 place-items-center text-[var(--color-ink-3)] transition-transform group-open:rotate-90"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                    <path d="M3 1 L7 5 L3 9 Z" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-semibold text-[var(--color-ink)]">
                      Week {w.weekIndex + 1}{" "}
                      <span className="ml-2 text-xs font-normal text-[var(--color-ink-3)]">
                        {w.block}
                      </span>
                    </h3>
                  </div>
                  <div className="mt-1 group-open:hidden">
                    <WeekStrip days={w.days} />
                  </div>
                </div>
              </div>
            </summary>

            {themes?.[w.weekIndex] && (
              <p className="border-t border-[var(--color-line)] bg-[var(--color-bg-2)] px-4 py-2 text-sm italic text-[var(--color-ink-2)]">
                {themes[w.weekIndex]}
              </p>
            )}
            <div className="divide-y divide-[var(--color-line)] border-t border-[var(--color-line)]">
              {w.days.map((d) => (
                <DaySummary
                  key={d.dayOfWeek}
                  dow={DOW[d.dayOfWeek] ?? `?`}
                  weekIndex={w.weekIndex}
                  dayOfWeek={d.dayOfWeek}
                  session={d.session}
                  log={workouts.get(`${w.weekIndex}-${d.dayOfWeek}`) ?? null}
                />
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

export function NarrativeSection({ plan }: { plan: Plan }) {
  const n = plan.narrative;
  if (!n) return null;
  const blockNames: BlockName[] = ["Base", "Build", "Peak", "Test"];
  return (
    <section className="print-keep">
      <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
        Coach notes
      </h2>
      <div className="mt-3 space-y-4">
        {blockNames.map((b) => (
          <div
            key={b}
            className="rounded-md border border-[var(--color-line)] bg-white p-4 print-keep"
          >
            <h3 className="font-semibold text-[var(--color-ink)]">{b}</h3>
            <p className="mt-1 text-sm text-[var(--color-ink-2)]">{n.blockIntros[b]}</p>
          </div>
        ))}
      </div>

      <h3 className="mt-6 text-xs font-mono uppercase tracking-wider text-[var(--color-ink-3)]">
        Form cues
      </h3>
      <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        {(Object.keys(n.formCues) as (keyof typeof n.formCues)[]).map((ev) => (
          <div key={ev} className="flex gap-3 border-b border-dashed border-[var(--color-line)] pb-1">
            <dt className="font-mono text-[var(--color-ink-3)]">{ev}</dt>
            <dd className="text-[var(--color-ink-2)]">{n.formCues[ev]}</dd>
          </div>
        ))}
      </dl>

      {Object.entries(n.exerciseSwaps).some(([, v]) => v) && (
        <>
          <h3 className="mt-6 text-xs font-mono uppercase tracking-wider text-[var(--color-ink-3)]">
            Injury substitutions
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-ink-2)]">
            {n.exerciseSwaps.deadlift && <li><b>Deadlift:</b> {n.exerciseSwaps.deadlift}</li>}
            {n.exerciseSwaps.squat && <li><b>Squat:</b> {n.exerciseSwaps.squat}</li>}
            {n.exerciseSwaps.push && <li><b>Push:</b> {n.exerciseSwaps.push}</li>}
            {n.exerciseSwaps.run && <li><b>Run:</b> {n.exerciseSwaps.run}</li>}
          </ul>
        </>
      )}

      <p className="mt-6 rounded-md border border-[var(--color-line)] bg-[var(--color-bg-2)] p-4 text-sm text-[var(--color-ink)]">
        {n.closingNote}
      </p>
    </section>
  );
}

function DaySummary({
  dow,
  weekIndex,
  dayOfWeek,
  session,
  log,
}: {
  dow: string;
  weekIndex: number;
  dayOfWeek: number;
  session: SessionPrescription;
  log: WorkoutLog | null;
}) {
  const done = Boolean(log?.completedAt);
  const actuals = log?.actuals?.exercises ?? [];

  return (
    <div className="grid grid-cols-[2.5rem_1fr] gap-3 px-3 py-2 text-sm sm:grid-cols-[3rem_1fr] sm:gap-4 sm:px-4 sm:py-3">
      <div className="flex flex-col items-start gap-1 pt-0.5">
        <span className="font-mono text-xs text-[var(--color-ink-3)]">{dow}</span>
        {done && (
          <span
            className="grid h-5 w-5 place-items-center rounded-full bg-[var(--color-accent)] text-[10px] text-[var(--color-accent-fg)]"
            aria-label="completed"
          >
            ✓
          </span>
        )}
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-medium text-[var(--color-ink)]">{session.title}</div>
          {!done && session.sessionType !== "rest" && (
            <form action={markWorkoutAction} className="print:hidden">
              <input type="hidden" name="weekIndex" value={weekIndex} />
              <input type="hidden" name="dayOfWeek" value={dayOfWeek} />
              <input type="hidden" name="action" value="mark" />
              <button
                type="submit"
                className="rounded-md border border-[var(--color-line)] bg-white px-2 py-0.5 text-[11px] text-[var(--color-ink-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                title="Mark this workout done"
              >
                ✓ Done
              </button>
            </form>
          )}
          {done && (
            <form action={markWorkoutAction} className="print:hidden">
              <input type="hidden" name="weekIndex" value={weekIndex} />
              <input type="hidden" name="dayOfWeek" value={dayOfWeek} />
              <input type="hidden" name="action" value="unmark" />
              <button
                type="submit"
                className="text-[11px] text-[var(--color-ink-3)] hover:text-[var(--color-danger)]"
                title="Undo completion"
              >
                undo
              </button>
            </form>
          )}
        </div>
        {session.main.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-[var(--color-ink-2)]">
            {session.main.map((ex, i) => {
              const act = actuals[i];
              const actualWeight = act?.actualWeightLb;
              const showActual =
                act &&
                ((actualWeight !== undefined && actualWeight !== ex.weightLb) ||
                  (act.actualReps && act.actualReps !== String(ex.reps)) ||
                  act.skipped);
              return (
                <li key={i} className="font-mono text-[11px] leading-snug sm:text-xs">
                  {ex.name}: {ex.sets}×{ex.reps}
                  {ex.weightLb ? ` @ ${ex.weightLb} lb` : ""}
                  {ex.weightDescriptor && !ex.weightLb ? ` (${ex.weightDescriptor})` : ""}
                  {showActual && (
                    <span className="ml-2 text-[var(--color-accent)]">
                      → {act?.skipped ? "skipped" : ""}
                      {actualWeight !== undefined && actualWeight !== ex.weightLb
                        ? ` ${actualWeight} lb`
                        : ""}
                      {act?.actualReps && act.actualReps !== String(ex.reps)
                        ? ` ${act.actualReps} reps`
                        : ""}
                    </span>
                  )}
                  {act?.notes && (
                    <span className="ml-2 italic text-[var(--color-ink-3)]">
                      ({act.notes})
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {session.sessionType !== "rest" && (
          <details className="mt-2 print:hidden">
            <summary className="cursor-pointer text-[11px] text-[var(--color-ink-3)] hover:text-[var(--color-accent)] [&::-webkit-details-marker]:hidden">
              {log?.actuals ? "Edit details" : "Log details"}
            </summary>
            <form
              action={logWorkoutDetailsAction}
              className="mt-2 space-y-2 rounded-md border border-[var(--color-line)] bg-[var(--color-bg-2)] p-3"
            >
              <input type="hidden" name="weekIndex" value={weekIndex} />
              <input type="hidden" name="dayOfWeek" value={dayOfWeek} />

              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-[11px]">
                  <thead>
                    <tr className="text-left text-[var(--color-ink-3)]">
                      <th className="py-1 pr-2 font-normal">Exercise</th>
                      <th className="py-1 px-1 font-normal">Actual lb</th>
                      <th className="py-1 px-1 font-normal">Actual reps</th>
                      <th className="py-1 px-1 font-normal">Skip</th>
                      <th className="py-1 pl-1 font-normal">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {session.main.map((ex, i) => {
                      const act = actuals[i];
                      return (
                        <tr key={i} className="border-t border-[var(--color-line)]">
                          <td className="py-1 pr-2 align-top font-mono text-[var(--color-ink-2)]">
                            {ex.name}
                            <div className="text-[10px] text-[var(--color-ink-3)]">
                              prescribed {ex.sets}×{ex.reps}
                              {ex.weightLb ? ` @ ${ex.weightLb}` : ""}
                            </div>
                          </td>
                          <td className="py-1 px-1 align-top">
                            <input
                              type="number"
                              name={`ex_${i}_weight`}
                              defaultValue={act?.actualWeightLb ?? ex.weightLb ?? ""}
                              min={0}
                              max={700}
                              className="w-16 rounded border border-[var(--color-line)] bg-white px-1 py-0.5"
                            />
                          </td>
                          <td className="py-1 px-1 align-top">
                            <input
                              type="text"
                              name={`ex_${i}_reps`}
                              defaultValue={act?.actualReps ?? ""}
                              placeholder={String(ex.reps)}
                              maxLength={40}
                              className="w-20 rounded border border-[var(--color-line)] bg-white px-1 py-0.5"
                            />
                          </td>
                          <td className="py-1 px-1 align-top">
                            <input
                              type="checkbox"
                              name={`ex_${i}_skipped`}
                              defaultChecked={act?.skipped ?? false}
                              className="h-4 w-4 rounded border-[var(--color-line)] text-[var(--color-accent)]"
                            />
                          </td>
                          <td className="py-1 pl-1 align-top">
                            <input
                              type="text"
                              name={`ex_${i}_notes`}
                              defaultValue={act?.notes ?? ""}
                              maxLength={300}
                              className="w-full min-w-[8rem] rounded border border-[var(--color-line)] bg-white px-1 py-0.5"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr]">
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
                    RPE 1-10
                  </span>
                  <input
                    type="number"
                    name="rpe"
                    min={1}
                    max={10}
                    defaultValue={log?.rpe ?? ""}
                    className="mt-0.5 block w-full rounded border border-[var(--color-line)] bg-white px-2 py-1 text-xs"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
                    Session note
                  </span>
                  <input
                    type="text"
                    name="notes"
                    defaultValue={log?.notes ?? ""}
                    placeholder="Felt strong, calf tight, etc."
                    maxLength={400}
                    className="mt-0.5 block w-full rounded border border-[var(--color-line)] bg-white px-2 py-1 text-xs"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="submit"
                  className="rounded-md bg-[var(--color-accent)] px-3 py-1 text-[11px] font-medium text-[var(--color-accent-fg)] hover:opacity-90"
                >
                  Save log
                </button>
              </div>
            </form>
          </details>
        )}
      </div>
    </div>
  );
}
