import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadActivePlan } from "@/lib/aft/plan-service";
import { loadWorkoutsForPlan } from "@/lib/aft/workout-service";
import type { Plan, SessionPrescription, SessionType } from "@/lib/planner";
import { CalendarNav } from "./calendar-nav";

/* ---------------- date helpers ---------------- */

const MS_PER_DAY = 86_400_000;
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}
function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
function ym(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}
function parseYm(input: string | undefined): Date {
  const now = new Date();
  const fallback = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  if (!input) return fallback;
  const m = /^(\d{4})-(\d{1,2})$/.exec(input);
  if (!m) return fallback;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  if (mo < 0 || mo > 11) return fallback;
  return new Date(Date.UTC(y, mo, 1));
}
function parseYmd(input: string | undefined): Date | null {
  if (!input) return null;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}
function snapToMonday(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  let offset: number;
  if (dow === 1) offset = 0;
  else if (dow === 0) offset = 1;
  else offset = 8 - dow;
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}
function addMonths(d: Date, months: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
}
function buildMonthGrid(monthStart: Date): Date[][] {
  // Sunday-first US layout. JS getUTCDay() returns 0=Sun..6=Sat, which is
  // exactly what we want as the column offset.
  const firstDow = monthStart.getUTCDay();
  const gridStart = new Date(monthStart);
  gridStart.setUTCDate(monthStart.getUTCDate() - firstDow);

  const out: Date[][] = [];
  for (let r = 0; r < 6; r++) {
    const row: Date[] = [];
    for (let c = 0; c < 7; c++) {
      const d = new Date(gridStart);
      d.setUTCDate(gridStart.getUTCDate() + r * 7 + c);
      row.push(d);
    }
    out.push(row);
  }
  return out;
}
function dayDiff(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / MS_PER_DAY);
}

/* ---------------- plan → date lookup ---------------- */

type PlanDayLookup = {
  weekIndex: number;
  dayOfWeek: number;
  session: SessionPrescription;
} | null;

function planDayForDate(date: Date, startMonday: Date, plan: Plan): PlanDayLookup {
  const elapsed = dayDiff(date, startMonday);
  if (elapsed < 0) return null;
  const weekIndex = Math.floor(elapsed / 7);
  const dayOfWeek = elapsed % 7;
  const week = plan.weeks[weekIndex];
  if (!week) return null;
  const day = week.days.find((d) => d.dayOfWeek === dayOfWeek);
  if (!day) return null;
  return { weekIndex, dayOfWeek, session: day.session };
}

const SESSION_PALETTE: Record<
  SessionType,
  { short: string; bg: string; fg: string }
> = {
  strength_a: { short: "Str A", bg: "var(--color-accent)", fg: "white" },
  strength_b: { short: "Str B", bg: "oklch(0.55 0.12 145)", fg: "white" },
  intervals: { short: "Int", bg: "var(--color-mdl)", fg: "white" },
  tempo: { short: "Tmp", bg: "oklch(0.62 0.14 60)", fg: "white" },
  long: { short: "Long", bg: "oklch(0.7 0.09 145)", fg: "white" },
  aft_skills: { short: "Skl", bg: "var(--color-sdc)", fg: "white" },
  sdc: { short: "SDC", bg: "var(--color-sdc)", fg: "white" },
  recovery: { short: "Rec", bg: "oklch(0.92 0.005 250)", fg: "var(--color-ink-2)" },
  rest: { short: "—", bg: "transparent", fg: "var(--color-ink-3)" },
};

/* ---------------- page ---------------- */

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; d?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const planRow = await loadActivePlan(session.user.id);
  if (!planRow) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">No plan yet</h1>
        <p className="mt-2 text-[var(--color-ink-2)]">
          Build a plan and the calendar will populate with your sessions.
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
  const { m, d } = await searchParams;
  const monthStart = parseYm(m);
  const selectedDate = parseYmd(d);

  const startMonday = snapToMonday(planRow.startDate);
  const planEnd = new Date(startMonday);
  planEnd.setUTCDate(planEnd.getUTCDate() + plan.input.durationWeeks * 7 - 1);

  const grid = buildMonthGrid(monthStart);
  const todayYmd = ymd(new Date());

  // Workouts keyed by `${weekIndex}-${dayOfWeek}` for completion badges
  const workouts = await loadWorkoutsForPlan({
    userId: session.user.id,
    planId: planRow.id,
  });

  // Selected day prescription
  const selected = selectedDate ? planDayForDate(selectedDate, startMonday, plan) : null;

  const monthLabel = monthStart.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--color-line)] pb-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-ink-3)]">
            Calendar
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{monthLabel}</h1>
        </div>
        <CalendarNav currentMonth={ym(monthStart)} />
        <Link
          href="/plan"
          className="text-sm text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
        >
          ← back to plan
        </Link>
      </header>

      <p className="mt-3 text-xs text-[var(--color-ink-3)]">
        Plan runs {ymd(startMonday)} → {ymd(planEnd)} ·{" "}
        <Link
          href={`/calendar?m=${ym(new Date())}`}
          className="text-[var(--color-accent)] hover:underline"
        >
          Today
        </Link>
      </p>

      <div className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-line)]">
        {WEEKDAY_SHORT.map((dow) => (
          <div
            key={dow}
            className="bg-[var(--color-bg-2)] py-2 text-center text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-3)]"
          >
            {dow}
          </div>
        ))}
        {grid.flat().map((day) => {
          const dayYmd = ymd(day);
          const inMonth = day.getUTCMonth() === monthStart.getUTCMonth();
          const isToday = dayYmd === todayYmd;
          const isSelected = selectedDate ? dayYmd === ymd(selectedDate) : false;
          const lookup = planDayForDate(day, startMonday, plan);
          const session = lookup?.session;
          const palette = session ? SESSION_PALETTE[session.sessionType] : null;
          const done = lookup
            ? Boolean(
                workouts.get(`${lookup.weekIndex}-${lookup.dayOfWeek}`)?.completedAt,
              )
            : false;

          const href = `/calendar?m=${ym(monthStart)}&d=${dayYmd}`;

          return (
            <Link
              key={dayYmd}
              href={href}
              className={
                "block min-h-[64px] bg-white p-1.5 transition-colors sm:min-h-[88px] " +
                (isSelected
                  ? "ring-2 ring-[var(--color-accent)]"
                  : isToday
                    ? "bg-[var(--color-accent-soft)]"
                    : !inMonth
                      ? "bg-[var(--color-bg-2)] text-[var(--color-ink-3)]"
                      : "")
              }
              scroll={false}
            >
              <div className="flex items-baseline justify-between">
                <span
                  className={
                    "text-xs font-medium " +
                    (isToday ? "text-[var(--color-accent)]" : inMonth ? "text-[var(--color-ink)]" : "text-[var(--color-ink-3)]")
                  }
                >
                  {day.getUTCDate()}
                </span>
                {done && (
                  <span
                    title="completed"
                    className="grid h-4 w-4 place-items-center rounded-full bg-[var(--color-accent)] text-[9px] text-white"
                  >
                    ✓
                  </span>
                )}
              </div>
              {session && palette && session.sessionType !== "rest" && (
                <div
                  className="mt-1 truncate rounded-sm px-1 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider sm:text-[10px]"
                  style={{
                    background: palette.bg,
                    color: palette.fg,
                    printColorAdjust: "exact",
                    WebkitPrintColorAdjust: "exact",
                  }}
                >
                  {palette.short}
                </div>
              )}
              {session && (
                <div className="mt-1 hidden truncate text-[10px] leading-tight text-[var(--color-ink-2)] sm:block">
                  {session.title.replace(/^AFT\s*•?\s*/i, "")}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <section className="mt-6 rounded-lg border border-[var(--color-line)] bg-white p-5">
          <header className="flex items-baseline justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-3)]">
                {selectedDate.toLocaleString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </p>
              {selected && (
                <h2 className="mt-1 text-lg font-semibold text-[var(--color-ink)]">
                  {selected.session.title}
                </h2>
              )}
            </div>
            {selected && (
              <span className="text-xs text-[var(--color-ink-3)]">
                Week {selected.weekIndex + 1} · {WEEKDAY_SHORT[selected.dayOfWeek]}
              </span>
            )}
          </header>

          {!selected ? (
            <p className="mt-3 text-sm text-[var(--color-ink-3)]">
              No session scheduled for this date — it's outside the plan window.
            </p>
          ) : (
            <>
              {selected.session.warmup.length > 0 && (
                <DetailBlock label="Warm-up" items={selected.session.warmup} />
              )}
              {selected.session.main.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-3)]">
                    Main
                  </h3>
                  <ul className="mt-1 space-y-0.5 font-mono text-xs text-[var(--color-ink-2)]">
                    {selected.session.main.map((ex, i) => (
                      <li key={i}>
                        {ex.name}: {ex.sets}×{ex.reps}
                        {ex.weightLb ? ` @ ${ex.weightLb} lb` : ""}
                        {ex.weightDescriptor && !ex.weightLb
                          ? ` (${ex.weightDescriptor})`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selected.session.cooldown.length > 0 && (
                <DetailBlock label="Cool-down" items={selected.session.cooldown} />
              )}
              {selected.session.notes && selected.session.notes.length > 0 && (
                <DetailBlock label="Notes" items={selected.session.notes} />
              )}
              <Link
                href="/plan"
                className="mt-4 inline-block text-xs text-[var(--color-accent)] hover:underline"
              >
                Log on /plan →
              </Link>
            </>
          )}
        </section>
      )}
    </main>
  );
}

function DetailBlock({ label, items }: { label: string; items: readonly string[] }) {
  return (
    <div className="mt-4">
      <h3 className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-3)]">
        {label}
      </h3>
      <ul className="mt-1 space-y-0.5 text-xs text-[var(--color-ink-2)]">
        {items.map((it, i) => (
          <li key={i}>· {it}</li>
        ))}
      </ul>
    </div>
  );
}
