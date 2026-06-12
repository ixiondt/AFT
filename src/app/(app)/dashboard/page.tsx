import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth, signOut } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { loadActivePlan } from "@/lib/aft/plan-service";
import { loadProgressSnapshot } from "@/lib/aft/progress-service";
import type { Plan } from "@/lib/planner";
import { PinSetupCard } from "./pin-setup";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ pin_error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const { pin_error } = await searchParams;
  const userRow = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
    columns: { pinHash: true },
  });
  const hasPin = Boolean(userRow?.pinHash);

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  const planRow = await loadActivePlan(session.user.id);

  if (!planRow) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <header className="flex items-baseline justify-between border-b border-[var(--color-line)] pb-4">
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-sm text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
            >
              Sign out
            </button>
          </form>
        </header>

        <div className="mt-6">
          <PinSetupCard hasPin={hasPin} errorParam={pin_error} />
        </div>

        <section className="mt-6 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-2)] p-6">
          <p className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
            Next step
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--color-ink)]">
            Build your profile and enter current scores
          </h2>
          <p className="mt-2 text-sm text-[var(--color-ink-2)]">
            We'll score against the official AFT tables, find your biggest point
            gaps, and generate a periodized plan for the duration you choose.
          </p>
          <Link
            href="/profile"
            className="mt-4 inline-block rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] hover:opacity-90"
          >
            Start
          </Link>
        </section>

        <p className="mt-12 text-xs text-[var(--color-ink-3)]">
          Signed in as <span className="font-mono">{session.user.email}</span>
        </p>
      </main>
    );
  }

  // Active plan exists — render the proper landing.
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

  const latestWeight = snapshot.weightLog[snapshot.weightLog.length - 1];
  // "Stale" if the most recent weigh-in is older than 7 days (or there is none).
  const weightStaleDays = latestWeight
    ? Math.floor(
        (Date.now() - Date.parse(latestWeight.recordedAt)) / 86_400_000,
      )
    : null;
  const weightNeedsLog =
    !latestWeight || (weightStaleDays !== null && weightStaleDays >= 7);

  // Find today's prescription (best-effort — day-0 = startDate)
  const startMs = planRow.startDate.getTime();
  const todayMs = Date.now();
  const dayElapsed = Math.floor((todayMs - startMs) / 86_400_000);
  const weekIndex = Math.floor(dayElapsed / 7);
  const dayOfWeek = ((dayElapsed % 7) + 7) % 7;
  const todayWeek = plan.weeks[weekIndex];
  const todaySession = todayWeek?.days.find((d) => d.dayOfWeek === dayOfWeek)?.session;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="flex items-baseline justify-between border-b border-[var(--color-line)] pb-4">
        <div>
          <p className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
            Dashboard
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Welcome back
          </h1>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-sm text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
          >
            Sign out
          </button>
        </form>
      </header>

      <section className="mt-6 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-2)] p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Current" value={`${plan.currentTotal}`} unit="pts" />
          <Stat label="Goal" value={`${plan.goalTotal}`} unit="pts" />
          <Stat label="Days to test" value={`${daysToTest}`} />
          <Stat
            label="Adherence"
            value={`${adherence}`}
            unit="%"
            tone={adherence >= 80 ? "good" : adherence >= 50 ? "ok" : "warn"}
          />
        </div>
        {latestWeight && (
          <p className="mt-3 text-xs text-[var(--color-ink-3)]">
            Latest weight:{" "}
            <span className="font-mono text-[var(--color-ink-2)]">
              {latestWeight.weightLb} lb
            </span>{" "}
            ({new Date(latestWeight.recordedAt).toLocaleDateString()})
          </p>
        )}
      </section>

      {weightNeedsLog && (
        <Link
          href="/plan#weight-log"
          className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-dashed border-[var(--color-line)] bg-white px-4 py-3 text-sm text-[var(--color-ink-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        >
          <span>
            {latestWeight
              ? `Last weigh-in was ${weightStaleDays} days ago.`
              : "No weigh-ins logged yet."}{" "}
            <span className="font-medium text-[var(--color-ink)]">Log today's weight →</span>
          </span>
        </Link>
      )}

      {todaySession && (
        <section className="mt-6 rounded-lg border border-[var(--color-line)] bg-white p-5">
          <p className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
            Today's session
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--color-ink)]">
            {todaySession.title}
          </h2>
          <p className="mt-1 text-xs text-[var(--color-ink-3)]">
            Week {(weekIndex ?? 0) + 1} ·{" "}
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][dayOfWeek]}
          </p>
          {todaySession.main.length > 0 && (
            <ul className="mt-3 space-y-0.5 text-[11px] text-[var(--color-ink-2)]">
              {todaySession.main.slice(0, 4).map((ex, i) => (
                <li key={i} className="font-mono">
                  {ex.name}: {ex.sets}×{ex.reps}
                  {ex.weightLb ? ` @ ${ex.weightLb} lb` : ""}
                </li>
              ))}
              {todaySession.main.length > 4 && (
                <li className="text-[var(--color-ink-3)]">
                  ...+{todaySession.main.length - 4} more
                </li>
              )}
            </ul>
          )}
          <Link
            href="/plan"
            className="mt-3 inline-block text-xs text-[var(--color-accent)] hover:underline"
          >
            View full plan →
          </Link>
        </section>
      )}

      <div className="mt-6">
        <PinSetupCard hasPin={hasPin} errorParam={pin_error} />
      </div>

      <section className="mt-6">
        <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
          Quick actions
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard
            href="/plan"
            title="View weekly plan"
            sub="Log workouts, weight, chat with the coach"
            primary
          />
          <ActionCard
            href="/calendar"
            title="Calendar"
            sub="See every session on a real month view"
          />
          <ActionCard
            href="/progress"
            title="Progress dashboard"
            sub="Trends, adherence, MDL/HRP/Plank curves"
          />
          <ActionCard
            href="/profile"
            title="Adjust profile or regenerate"
            sub="Update scores, goals, test date, preferences"
          />
          <ActionCard
            href={`/api/plan/ics`}
            title="Download to calendar"
            sub=".ics file with every training session"
            download="aft-plan.ics"
          />
        </div>
      </section>

      <p className="mt-12 text-xs text-[var(--color-ink-3)]">
        Signed in as <span className="font-mono">{session.user.email}</span> · Plan
        from {new Date(plan.generatedAt).toLocaleDateString()}
        {plan.input.preferences.calisthenicsPreferred ? " · calisthenics" : ""}
        {plan.input.preferences.activeRecovery ? " · active recovery" : ""}
      </p>
    </main>
  );
}

function Stat({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "good" | "ok" | "warn";
}) {
  const color =
    tone === "good"
      ? "text-[var(--color-accent)]"
      : tone === "warn"
        ? "text-[var(--color-danger)]"
        : "text-[var(--color-ink)]";
  return (
    <div>
      <div className="text-xs text-[var(--color-ink-3)]">{label}</div>
      <div className={`font-mono text-2xl font-semibold ${color}`}>
        {value}
        {unit && (
          <span className="ml-1 text-sm font-normal text-[var(--color-ink-3)]">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function ActionCard({
  href,
  title,
  sub,
  primary,
  download,
}: {
  href: string;
  title: string;
  sub: string;
  primary?: boolean;
  download?: string;
}) {
  const cls = primary
    ? "block rounded-lg border border-[var(--color-accent)] bg-[var(--color-accent)] p-4 text-[var(--color-accent-fg)] hover:opacity-90"
    : "block rounded-lg border border-[var(--color-line)] bg-white p-4 text-[var(--color-ink)] hover:border-[var(--color-accent)]";
  return download ? (
    <a href={href} download={download} className={cls}>
      <div className="font-semibold">{title}</div>
      <div className={`mt-0.5 text-xs ${primary ? "opacity-80" : "text-[var(--color-ink-3)]"}`}>
        {sub}
      </div>
    </a>
  ) : (
    <Link href={href} className={cls}>
      <div className="font-semibold">{title}</div>
      <div className={`mt-0.5 text-xs ${primary ? "opacity-80" : "text-[var(--color-ink-3)]"}`}>
        {sub}
      </div>
    </Link>
  );
}
