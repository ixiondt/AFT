import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadActivePlan } from "@/lib/aft/plan-service";
import type { Plan } from "@/lib/planner";
import { env } from "@/lib/env";
import { loadChatHistory } from "@/lib/aft/chat-service";
import { loadWeightLog } from "@/lib/aft/weight-service";
import { loadWorkoutsForPlan } from "@/lib/aft/workout-service";
import {
  BlockBar,
  CheckpointList,
  GapTable,
  MdlLadderTable,
  NarrativeSection,
  PaceCard,
  PlanSummary,
  RealismCard,
  AccommodationsCard,
  WeeklyCalendar,
} from "./components";
import { ChatPanel, type ChatMessageView } from "./chat-panel";
import { PrintButton } from "./print-button";
import { WeightTracker } from "./weight-tracker";
import { Callout, Chip } from "@/components/ui";

export default async function PlanPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const planRow = await loadActivePlan(session.user.id);
  if (!planRow) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">No plan yet</h1>
        <p className="mt-2 text-[var(--color-ink-2)]">
          Build your profile and enter your AFT scores to generate one.
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
  const chatHistory = await loadChatHistory(planRow.id);
  const chatMessages: ChatMessageView[] = chatHistory.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }));
  const groqEnabled = Boolean(env.groqApiKey);
  // Weight log is per-user, not per-plan. Regenerating a plan should NOT
  // hide history — keep showing every weigh-in this person has ever logged.
  const weightEntries = await loadWeightLog({
    userId: session.user.id,
  });
  // Prefill the log form with the most recent weigh-in so the next log is one
  // tap — only fall back to the plan's starting bodyweight when nothing has
  // been logged yet.
  const latestLoggedWeight =
    weightEntries[weightEntries.length - 1]?.weightLb ?? plan.input.bodyweightLb;
  const workoutLogs = await loadWorkoutsForPlan({
    userId: session.user.id,
    planId: planRow.id,
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="flex flex-col gap-4 border-b border-[var(--color-line)] pb-4 sm:flex-row sm:items-baseline sm:justify-between print:border-b-0">
        <div>
          <p className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
            Active plan
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Your AFT program</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden sm:gap-3">
          <Link
            href="/calendar"
            className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm text-[var(--color-ink-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            Calendar
          </Link>
          <Link
            href="/progress"
            className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm text-[var(--color-ink-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            Progress
          </Link>
          <a
            href="/api/plan/ics"
            download="aft-plan.ics"
            className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm text-[var(--color-ink-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            Download .ics
          </a>
          <PrintButton />
          <Link
            href="/profile"
            className="text-sm text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
          >
            Regenerate
          </Link>
        </div>
      </header>

      <Callout tone="info" title="Your program at a glance" className="mt-6 print:hidden">
        <span>
          {plan.input.durationWeeks} weeks · {plan.currentTotal} → {plan.goalTotal} pts
          · test {new Date(plan.input.testDate).toLocaleDateString()}. Log actuals
          and mark sessions done to keep it honest.
        </span>
        <span className="mt-2 flex flex-wrap gap-1.5">
          <Chip color="var(--color-2mr)">{plan.input.daysPerWeek} days/week</Chip>
          {plan.input.preferences.calisthenicsPreferred && (
            <Chip color="var(--color-hrp)">calisthenics</Chip>
          )}
          {plan.input.preferences.activeRecovery && (
            <Chip color="var(--color-plk)">active recovery</Chip>
          )}
          {plan.input.injuries.map((inj) => (
            <Chip key={inj} tone="warn">
              {inj.replace("_", " ")}
            </Chip>
          ))}
        </span>
      </Callout>

      <div className="mt-8 space-y-10">
        <PlanSummary plan={plan} />
        <AccommodationsCard plan={plan} />
        <RealismCard plan={plan} />
        <GapTable plan={plan} />
        <BlockBar plan={plan} />
        <NarrativeSection plan={plan} />
        <PaceCard plan={plan} />
        <MdlLadderTable plan={plan} />
        <CheckpointList plan={plan} />
        <WeightTracker
          entries={weightEntries}
          currentWeightLb={latestLoggedWeight}
          {...(plan.input.goalBodyweightLb
            ? { goalWeightLb: plan.input.goalBodyweightLb }
            : {})}
        />
        <WeeklyCalendar plan={plan} workouts={workoutLogs} />
      </div>

      <ChatPanel messages={chatMessages} groqEnabled={groqEnabled} />

      <footer className="mt-12 border-t border-[var(--color-line)] pt-4 text-xs text-[var(--color-ink-3)]">
        Plan generated {new Date(plan.generatedAt).toLocaleString()} · scoring per official
        AFT scales effective 1 June 2025.
      </footer>
    </main>
  );
}
