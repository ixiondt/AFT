import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAuthAndUser } from "@/lib/auth";
import { loadActivePlan } from "@/lib/aft/plan-service";
import type { Plan, SessionType } from "@/lib/planner";
import { AppNav } from "../app-nav";

const SHORT_LABEL: Record<SessionType, string> = {
  strength_a: "Str A",
  strength_b: "Str B",
  intervals: "Int",
  tempo: "Tempo",
  long: "Long run",
  aft_skills: "Skills",
  sdc: "SDC",
  recovery: "Recovery",
  rest: "Rest",
};

const MS_PER_DAY = 86_400_000;

function snapToMonday(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay();
  let offset: number;
  if (dow === 1) offset = 0;
  else if (dow === 0) offset = 1;
  else offset = 8 - dow;
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthAndUser();
  // Disabled accounts hard-redirect to sign-in with a clear flag.
  if (auth?.disabled) redirect("/signin?error=disabled");

  const isAdmin = auth?.user?.role === "admin";

  return (
    <>
      {/* Render the nav shell immediately with no badge so paint isn't blocked
          on the plan query. The page's own loadActivePlan() shares this same
          DB read via cache(), so streaming the badge is essentially free. */}
      <AppNav isAdmin={isAdmin}>
        {auth ? (
          <Suspense fallback={null}>
            <TodayBadge userId={auth.user.id} />
          </Suspense>
        ) : null}
      </AppNav>
      {children}
    </>
  );
}

async function TodayBadge({ userId }: { userId: string }): Promise<React.ReactNode> {
  const planRow = await loadActivePlan(userId);
  if (!planRow) return null;
  const plan = planRow.payload as Plan;
  const startMonday = snapToMonday(planRow.startDate);
  const elapsed = Math.floor((Date.now() - startMonday.getTime()) / MS_PER_DAY);
  if (elapsed < 0 || elapsed >= plan.input.durationWeeks * 7) return null;
  const weekIndex = Math.floor(elapsed / 7);
  const dayOfWeek = ((elapsed % 7) + 7) % 7;
  const day = plan.weeks[weekIndex]?.days.find((d) => d.dayOfWeek === dayOfWeek);
  if (!day || day.session.sessionType === "rest") return null;
  return (
    <a
      href="/plan"
      className="hidden items-center gap-1.5 rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-medium text-[var(--color-accent)] hover:opacity-90 md:flex"
      title="Today's scheduled session"
    >
      <span
        className="block h-1.5 w-1.5 animate-pulse rounded-full"
        style={{ background: "var(--color-accent)" }}
        aria-hidden="true"
      />
      Today · {SHORT_LABEL[day.session.sessionType]}
    </a>
  );
}
