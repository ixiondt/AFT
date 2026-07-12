import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadActivePlan } from "@/lib/aft/plan-service";
import { loadProgressSnapshot } from "@/lib/aft/progress-service";
import type { Plan } from "@/lib/planner";
import { secToMmss } from "@/lib/scoring";
import { Callout, ProgressBar, Stat } from "@/components/ui";
import { CompletionCard, WeeklyChartCard } from "./charts";

export default async function ProgressPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const planRow = await loadActivePlan(session.user.id);
  if (!planRow) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">No plan yet</h1>
        <p className="mt-2 text-[var(--color-ink-2)]">
          Build a plan first to track progress against it.
        </p>
        <Link
          href="/profile"
          className="mt-6 inline-block rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] hover:opacity-90"
        >
          Start
        </Link>
      </main>
    );
  }
  const plan = planRow.payload as Plan;
  const snapshot = await loadProgressSnapshot({
    userId: session.user.id,
    planId: planRow.id,
    plan,
  });

  const testDate = new Date(plan.input.testDate);
  const daysToTest = Math.max(
    0,
    Math.round((testDate.getTime() - Date.now()) / 86_400_000),
  );

  const totalPrescribed = snapshot.completion.reduce((a, w) => a + w.prescribed, 0);
  const totalCompleted = snapshot.completion.reduce((a, w) => a + w.completed, 0);
  const adherence =
    totalPrescribed > 0 ? Math.round((totalCompleted / totalPrescribed) * 100) : 0;
  const adherenceTone = adherence >= 80 ? "good" : adherence >= 50 ? "warn" : "danger";

  // Map weight log → WeeklyPoint by snapping each entry to its closest week.
  const weeklyWeight = snapshot.weightLog.length
    ? snapToWeeks(snapshot.weightLog, planRow.startDate, plan.input.durationWeeks)
    : Array.from({ length: plan.input.durationWeeks }, (_, i) => ({
        weekIndex: i,
        value: null,
      }));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="flex items-baseline justify-between border-b border-[var(--color-line)] pb-4">
        <div>
          <p className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
            Progress
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            How the work is landing
          </h1>
        </div>
        <Link
          href="/plan"
          className="text-sm text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
        >
          ← back to plan
        </Link>
      </header>

      <section className="mt-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-2)] p-6">
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
          <Stat label="Current" value={plan.currentTotal} unit="pts" size="md" />
          <span className="text-2xl text-[var(--color-ink-3)]">→</span>
          <Stat label="Goal" value={plan.goalTotal} unit="pts" size="md" tone="good" />
          <span className="hidden md:inline text-2xl text-[var(--color-ink-3)]">·</span>
          <Stat label="Test date" value={plan.input.testDate} size="md" />
          <Stat label="Days to go" value={daysToTest} size="md" />
          <Stat label="Logged actuals" value={snapshot.totalActuals} size="md" />
        </div>

        <ProgressBar
          className="mt-5"
          value={adherence}
          tone={adherenceTone}
          label="Overall completion"
          valueLabel={
            totalPrescribed > 0
              ? `${totalCompleted}/${totalPrescribed} · ${adherence}%`
              : "no sessions logged yet"
          }
        />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <CompletionCard data={snapshot.completion} />
        <WeeklyChartCard
          title="Weight"
          data={weeklyWeight}
          fmt="lb"
          empty="Log weights on /plan to see the trend."
        />
        <WeeklyChartCard
          title="MDL working weight"
          data={snapshot.mdlMax}
          fmt="lb"
          target={plan.input.goal.MDL}
          empty="Log a deadlift weight on a workout to see the curve."
        />
        <WeeklyChartCard
          title="HRP volume (max set logged)"
          data={snapshot.hrpMax}
          fmt="reps"
          target={plan.input.goal.HRP}
          empty="Log a set of HRPs on a workout to see the curve."
        />
        <WeeklyChartCard
          title="Plank max"
          data={snapshot.plkMax}
          fmt="mmss"
          target={plan.input.goal.PLK}
          empty="Log a plank hold as m:ss on a workout to see the curve."
        />
        <WeeklyChartCard
          title="RPE (avg per week)"
          data={snapshot.rpe}
          fmt="rpe"
          empty="Log RPE 1-10 per workout to spot fatigue trends."
        />
      </div>

      <Callout tone="info" className="mt-10">
        Charts auto-populate as you mark workouts done and log actuals on the
        plan. Empty cards aren't broken — just no data there yet.
      </Callout>
    </main>
  );
}

function snapToWeeks(
  log: ReadonlyArray<{ recordedAt: string; weightLb: number }>,
  startDate: Date,
  weeks: number,
): Array<{ weekIndex: number; value: number | null }> {
  const start = startDate.getTime();
  const out: Array<{ weekIndex: number; value: number | null }> = [];
  for (let w = 0; w < weeks; w++) {
    const weekStart = start + w * 7 * 86_400_000;
    const weekEnd = weekStart + 7 * 86_400_000;
    const inWeek = log.filter(
      (e) => Date.parse(e.recordedAt) >= weekStart && Date.parse(e.recordedAt) < weekEnd,
    );
    out.push({
      weekIndex: w,
      value: inWeek.length
        ? inWeek.reduce((a, b) => a + b.weightLb, 0) / inWeek.length
        : null,
    });
  }
  return out;
}
