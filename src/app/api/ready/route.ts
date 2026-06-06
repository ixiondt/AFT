/**
 * Readiness probe — verifies the DB is reachable and the scoring data loaded.
 * 200 = serving traffic, 503 = not ready.
 */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { SCORING_DATA } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await db.execute(sql`select 1`);
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "DB_UNREACHABLE",
          message: "Postgres is not responding",
          retryable: true,
        },
        details: { err: (err as Error).message },
      },
      { status: 503, headers: { "Retry-After": "5" } },
    );
  }

  if (!SCORING_DATA.events?.MDL) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "SCORING_DATA_MISSING",
          message: "AFT scoring tables failed to load",
          retryable: false,
        },
      },
      { status: 503 },
    );
  }

  return Response.json({ ok: true, ts: new Date().toISOString() });
}
