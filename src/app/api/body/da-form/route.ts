/**
 * Generate a filled DA 5500 (male) or DA 5501 (female) body fat worksheet from
 * the user's latest /body measurements. Auto-selects the right form based on
 * the profile's sex.
 *
 * Query params:
 *   ?rank=SGT       (optional, written into the Rank field)
 *   ?prepared_by=...&prepared_by_rank=... (optional preparer block)
 *   ?remarks=...    (optional remarks text)
 */
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { loadWeightLog } from "@/lib/aft/weight-service";
import {
  armyBodyFatMaxPct,
  tapeBodyFatPct,
} from "@/lib/aft/body-comp";
import { ddmmmyyyy, fillDa5500, fillDa5501 } from "@/lib/aft/da-form";
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
      "Log a weight + abdomen measurement first on /body",
      400,
    );
  }
  const abdomenIn = latest.measurements?.abdomenIn ?? latest.measurements?.waistIn;
  if (!abdomenIn) {
    return jsonError(
      "NO_ABDOMEN",
      "Log an abdomen measurement on /body before exporting",
      400,
    );
  }

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
    columns: { name: true, email: true },
  });

  const bf = tapeBodyFatPct({
    sex: profile.sex,
    weightLb: latest.weightLb,
    measurements: latest.measurements ?? {},
  });
  if (bf === null) {
    return jsonError("CALC_FAILED", "Body fat % could not be computed", 400);
  }

  const data = {
    name: user?.name?.trim() || (user?.email?.split("@")[0] ?? ""),
    rank: url.searchParams.get("rank") || undefined,
    heightIn: profile.heightIn,
    weightLb: latest.weightLb,
    age: profile.age,
    abdomenIn,
    bodyFatPct: bf,
    maxBfPct: armyBodyFatMaxPct(profile.age, profile.sex),
    remarks: url.searchParams.get("remarks") || undefined,
    preparedByName: url.searchParams.get("prepared_by") || undefined,
    preparedByRank: url.searchParams.get("prepared_by_rank") || undefined,
    date: ddmmmyyyy(),
  };

  let pdfBytes: Uint8Array;
  let filename: string;
  try {
    if (profile.sex === "MC") {
      pdfBytes = await fillDa5500(data);
      filename = "DA-5500-filled.pdf";
    } else {
      pdfBytes = await fillDa5501(data);
      filename = "DA-5501-filled.pdf";
    }
  } catch (err) {
    logger.error(
      { err: (err as Error).message, userId: session.user.id },
      "da-form fill failed",
    );
    return jsonError("FILL_FAILED", "Could not generate the form", 500);
  }

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
