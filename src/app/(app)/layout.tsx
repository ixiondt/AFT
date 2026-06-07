import { auth } from "@/lib/auth";
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
  const session = await auth();
  let todayBadge: string | null = null;

  if (session?.user?.id) {
    const planRow = await loadActivePlan(session.user.id);
    if (planRow) {
      const plan = planRow.payload as Plan;
      const startMonday = snapToMonday(planRow.startDate);
      const elapsed = Math.floor((Date.now() - startMonday.getTime()) / MS_PER_DAY);
      if (elapsed >= 0 && elapsed < plan.input.durationWeeks * 7) {
        const weekIndex = Math.floor(elapsed / 7);
        const dayOfWeek = ((elapsed % 7) + 7) % 7;
        const day = plan.weeks[weekIndex]?.days.find((d) => d.dayOfWeek === dayOfWeek);
        if (day && day.session.sessionType !== "rest") {
          todayBadge = SHORT_LABEL[day.session.sessionType];
        }
      }
    }
  }

  return (
    <>
      <AppNav todayBadge={todayBadge} />
      {children}
    </>
  );
}
