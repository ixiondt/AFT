import { auth } from "@/lib/auth";
import { loadActivePlan } from "@/lib/aft/plan-service";
import { planToIcs } from "@/lib/aft/ics";
import type { Plan } from "@/lib/planner";

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(
      JSON.stringify({
        error: { code: "UNAUTHORIZED", message: "Sign in to download your plan", retryable: false },
      }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }
  const planRow = await loadActivePlan(session.user.id);
  if (!planRow) {
    return new Response(
      JSON.stringify({
        error: { code: "NOT_FOUND", message: "No active plan to export", retryable: false },
      }),
      { status: 404, headers: { "content-type": "application/json" } },
    );
  }
  const plan = planRow.payload as Plan;
  const ics = planToIcs({
    plan,
    planId: planRow.id,
    startDate: planRow.startDate,
  });
  const filename = `aft-plan-${plan.input.durationWeeks}wk.ics`;
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
