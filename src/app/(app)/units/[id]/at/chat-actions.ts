"use server";

import { revalidatePath } from "next/cache";
import { requireUnitAccess } from "@/lib/auth";
import { setFlash } from "@/lib/flash";
import { loadActiveAtPlan } from "@/lib/at/service";
import { postAtChatMessage } from "@/lib/at/chat-service";

export async function postAtChatAction(formData: FormData): Promise<void> {
  const unitId = String(formData.get("unitId") ?? "");
  const ctx = await requireUnitAccess(unitId, ["mft"]);

  const message = String(formData.get("message") ?? "");
  if (!message.trim()) return;

  const planRow = await loadActiveAtPlan(unitId);
  if (!planRow) {
    await setFlash("Generate an AT plan first", "error");
    revalidatePath(`/units/${unitId}/at`);
    return;
  }

  const res = await postAtChatMessage({
    userId: ctx.userId,
    unitId,
    atPlanId: planRow.id,
    message,
  });
  if (!res.ok) await setFlash(res.error, "error");
  revalidatePath(`/units/${unitId}/at`);
}
