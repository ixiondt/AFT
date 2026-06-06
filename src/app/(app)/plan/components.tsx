import { secToMmss } from "@/lib/scoring";
import type { BlockName, Plan, SessionPrescription } from "@/lib/planner";

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

export function WeeklyCalendar({ plan }: { plan: Plan }) {
  const themes = plan.narrative?.weeklyThemes;
  return (
    <section className="print-break-before">
      <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
        Week-by-week
      </h2>
      <div className="mt-3 space-y-6">
        {plan.weeks.map((w) => (
          <div
            key={w.weekIndex}
            className="rounded-md border border-[var(--color-line)] bg-white print-keep"
          >
            <div className="flex items-baseline justify-between border-b border-[var(--color-line)] px-4 py-2">
              <h3 className="font-semibold">
                Week {w.weekIndex + 1}{" "}
                <span className="ml-2 text-xs font-normal text-[var(--color-ink-3)]">
                  {w.block}
                </span>
              </h3>
            </div>
            {themes?.[w.weekIndex] && (
              <p className="border-b border-[var(--color-line)] bg-[var(--color-bg-2)] px-4 py-2 text-sm italic text-[var(--color-ink-2)]">
                {themes[w.weekIndex]}
              </p>
            )}
            <div className="divide-y divide-[var(--color-line)]">
              {w.days.map((d) => (
                <DaySummary key={d.dayOfWeek} dow={DOW[d.dayOfWeek] ?? `?`} session={d.session} />
              ))}
            </div>
          </div>
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

function DaySummary({ dow, session }: { dow: string; session: SessionPrescription }) {
  return (
    <div className="grid grid-cols-[3rem_1fr] gap-4 px-4 py-3 text-sm">
      <div className="font-mono text-xs text-[var(--color-ink-3)]">{dow}</div>
      <div>
        <div className="font-medium text-[var(--color-ink)]">{session.title}</div>
        {session.main.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-[var(--color-ink-2)]">
            {session.main.map((ex, i) => (
              <li key={i} className="font-mono text-xs">
                {ex.name}: {ex.sets}×{ex.reps}
                {ex.weightLb ? ` @ ${ex.weightLb} lb` : ""}
                {ex.weightDescriptor && !ex.weightLb ? ` (${ex.weightDescriptor})` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
