/**
 * Generate a filled DA Form 5500 (Jul 2026) — the Army Body Composition
 * Screening and Assessment Worksheet — from the user's latest /body WHtR
 * measurement. One form for all Soldiers (WHtR is the sole standard per Army
 * Directive 2026-13; DA 5501 is rescinded).
 *
 * Query params (all optional):
 *   ?rank=SGT
 *   ?prepared_by=...&prepared_by_rank=...
 *   ?approved_by=...&approved_by_rank=...
 *   ?remarks=...
 */
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { loadWeightLog } from "@/lib/aft/weight-service";
import {
  averageWaist,
  roundDownHalfInch,
  roundNearestHalfInch,
  truncateWhtR3,
  whtRArmyPass,
} from "@/lib/aft/body-comp";
import { fillDa5500, yyyymmdd, type WhtrMeasurement } from "@/lib/aft/da-form";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function jsonError(code: string, message: string, status: number): Response {
  return Response.json(
    { error: { code, message, retryable: false } },
    { status },
  );
}

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("UNAUTHORIZED", "Sign in to download the form", 401);
  }
  const url = new URL(request.url);

  const profile = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, session.user.id),
  });
  if (!profile) {
    return jsonError(
      "NO_PROFILE",
      "Set up your profile (age, sex, height) first on /body",
      400,
    );
  }
  if (!profile.heightIn) {
    return jsonError(
      "NO_HEIGHT",
      "Add your height on /body before exporting the form",
      400,
    );
  }

  const log = await loadWeightLog({ userId: session.user.id });
  const latest = log[log.length - 1];
  if (!latest) {
    return jsonError(
      "NO_MEASUREMENTS",
      "Log a waist measurement first on /body",
      400,
    );
  }

  // Prefer the three-reading array; fall back to a single waist value repeated
  // across the three cells (a Soldier who logged one number).
  const stored = latest.measurements ?? {};
  const rawReadings =
    stored.waistReadings && stored.waistReadings.length >= 3
      ? stored.waistReadings
      : (() => {
          const single = stored.waistIn ?? stored.abdomenIn;
          return single ? [single, single, single] : [];
        })();
  const waistReadings = rawReadings.map(roundDownHalfInch);
  const waistAverage = averageWaist(waistReadings);
  if (waistAverage === null) {
    return jsonError(
      "NO_WAIST",
      "Log a waist measurement on /body before exporting",
      400,
    );
  }

  const heightIn = roundNearestHalfInch(profile.heightIn);
  const rawRatio = waistAverage / heightIn;
  const initial: WhtrMeasurement = {
    waistReadings,
    waistAverage,
    whtr: truncateWhtR3(rawRatio),
  };

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
    columns: { name: true, email: true },
  });

  const data = {
    name: user?.name?.trim() || (user?.email?.split("@")[0] ?? ""),
    rank: url.searchParams.get("rank") || undefined,
    sex: profile.sex,
    heightIn,
    age: profile.age,
    initial,
    compliant: whtRArmyPass(rawRatio),
    remarks: url.searchParams.get("remarks") || undefined,
    preparedByName: url.searchParams.get("prepared_by") || undefined,
    preparedByRank: url.searchParams.get("prepared_by_rank") || undefined,
    approvedByName: url.searchParams.get("approved_by") || undefined,
    approvedByRank: url.searchParams.get("approved_by_rank") || undefined,
    date: yyyymmdd(),
  };

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await fillDa5500(data);
  } catch (err) {
    logger.error(
      { err: (err as Error).message, userId: session.user.id },
      "da-form fill failed",
    );
    return jsonError("FILL_FAILED", "Could not generate the form", 500);
  }

  const filename = "DA-5500-filled.pdf";
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
