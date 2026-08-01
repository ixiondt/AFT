/**
 * Generate an ABCP enrollment paperwork PDF (Army memorandum) for the current
 * Soldier. Types:
 *   /api/body/memo/counseling      — Commander's Counseling (EXORD Annex C)
 *   /api/body/memo/acknowledgement — Soldier's Acknowledgement (EXORD Annex D)
 *   /api/body/memo/medical         — Medical Evaluation Request (AD 2026-13)
 *
 * Every field is an optional query param; unset fields render as bracketed
 * placeholders the unit fills in by hand. Soldier name defaults to the account.
 */
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { renderArmyMemo, longDate } from "@/lib/aft/abcp-memo";
import {
  commanderCounselingMemo,
  medicalEvaluationRequestMemo,
  soldierAcknowledgementMemo,
  type PaperworkParams,
} from "@/lib/aft/abcp-paperwork";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const BUILDERS = {
  counseling: commanderCounselingMemo,
  acknowledgement: soldierAcknowledgementMemo,
  medical: medicalEvaluationRequestMemo,
} as const;

type MemoType = keyof typeof BUILDERS;

const FILENAMES: Record<MemoType, string> = {
  counseling: "ABCP-Commander-Counseling.pdf",
  acknowledgement: "ABCP-Soldier-Acknowledgement.pdf",
  medical: "ABCP-Medical-Evaluation-Request.pdf",
};

function jsonError(code: string, message: string, status: number): Response {
  return Response.json(
    { error: { code, message, retryable: false } },
    { status },
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ type: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("UNAUTHORIZED", "Sign in to download the memo", 401);
  }

  const { type } = await context.params;
  if (!(type in BUILDERS)) {
    return jsonError("NOT_FOUND", "Unknown memo type", 404);
  }
  const memoType = type as MemoType;

  const url = new URL(request.url);
  const q = (key: string) => url.searchParams.get(key) || undefined;

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
    columns: { name: true, email: true },
  });
  const defaultName = user?.name?.trim() || user?.email?.split("@")[0] || undefined;

  const params: PaperworkParams = {
    date: longDate(),
    officeSymbol: q("office_symbol"),
    orgName: q("org_name"),
    orgAddress: q("org_address"),
    orgCityStateZip: q("org_city_state_zip"),
    unit: q("unit"),
    soldierName: q("soldier_name") || defaultName,
    soldierRank: q("soldier_rank"),
    soldierBranch: q("soldier_branch"),
    dodid: q("dodid"),
    commanderName: q("commander_name"),
    commanderRank: q("commander_rank"),
    commanderTitle: q("commander_title"),
    pocName: q("poc_name"),
    pocEmail: q("poc_email"),
    pocPhone: q("poc_phone"),
  };

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await renderArmyMemo(BUILDERS[memoType](params));
  } catch (err) {
    logger.error(
      { err: (err as Error).message, userId: session.user.id, memoType },
      "abcp memo render failed",
    );
    return jsonError("RENDER_FAILED", "Could not generate the memo", 500);
  }

  const filename = FILENAMES[memoType];
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
