import { auth } from "@/lib/auth";
import { loadActivePlan } from "@/lib/aft/plan-service";
import { planToIcs } from "@/lib/aft/ics";
import { logger } from "@/lib/logger";
import type { Plan } from "@/lib/planner";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
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
  // ?all=1 includes recovery days too; default omits them so calendars stay clean.
  const url = new URL(request.url);
  const trainingOnly = url.searchParams.get("all") !== "1";

  let ics: string;
  try {
    ics = planToIcs({
      plan,
      planId: planRow.id,
      startDate: planRow.startDate,
      trainingOnly,
    });
  } catch (err) {
    logger.error(
      { err: (err as Error).message, planId: planRow.id, userId: session.user.id },
      "ics generation failed",
    );
    return Response.json(
      {
        error: {
          code: "ICS_GENERATION_FAILED",
          message: "Could not build calendar file",
          retryable: true,
        },
      },
      { status: 500 },
    );
  }

  const filename = `aft-plan-${plan.input.durationWeeks}wk.ics`;
  // RFC 5987 filename* gets the unicode-safe form; plain filename= is the
  // fallback for older clients. Both pinning .ics prevents the browser from
  // appending .txt based on Content-Type sniffing.
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8; method=PUBLISH",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
