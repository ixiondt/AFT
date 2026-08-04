import { requireUnitAccess } from "@/lib/auth";
import { loadActiveAtPlan } from "@/lib/at/service";
import { renderAtPlanPdf } from "@/lib/at/pdf";
import type { AtPlan } from "@/lib/at";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message, retryable: false } }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  // Owner/MFT only — reuse the same gate as the AT planning page.
  await requireUnitAccess(id, ["mft"]);

  const row = await loadActiveAtPlan(id);
  if (!row) {
    return jsonError("NO_AT_PLAN", "Generate an AT plan first", 400);
  }

  try {
    const bytes = await renderAtPlanPdf(row.payload as AtPlan);
    const filename = `AT-PT-${id}.pdf`;
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    logger.error({ err: (err as Error).message, unitId: id }, "AT plan PDF render failed");
    return jsonError("PDF_FAILED", "Could not render the PDF", 500);
  }
}
