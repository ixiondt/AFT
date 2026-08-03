"use server";

import { redirect } from "next/navigation";
import { requireUnitAccess } from "@/lib/auth";
import { setFlash } from "@/lib/flash";
import { logger } from "@/lib/logger";
import { generateAndSaveAtPlan } from "@/lib/at/service";

export async function generateAtPlanAction(formData: FormData): Promise<void> {
  const unitId = String(formData.get("unitId") ?? "");
  const ctx = await requireUnitAccess(unitId, ["mft"]);

  const startDateISO = String(formData.get("startDate") ?? "");
  const days = Number.parseInt(String(formData.get("days") ?? ""), 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateISO)) {
    await setFlash("Pick a valid AT start date", "error");
    redirect(`/units/${unitId}/at`);
  }
  if (!Number.isInteger(days) || days < 1 || days > 21) {
    await setFlash("AT length must be 1–21 days", "error");
    redirect(`/units/${unitId}/at`);
  }

  try {
    await generateAndSaveAtPlan({
      unitId,
      unitName: ctx.unit.name,
      startDateISO,
      days,
    });
    await setFlash("AT plan generated");
  } catch (err) {
    logger.error({ err: (err as Error).message, unitId }, "AT plan generation failed");
    await setFlash("Could not generate the AT plan. Try again.", "error");
  }
  redirect(`/units/${unitId}/at`);
}
