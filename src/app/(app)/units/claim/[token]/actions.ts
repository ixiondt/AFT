"use server";

import { redirect } from "next/navigation";
import { getAuthAndUser } from "@/lib/auth";
import { setFlash } from "@/lib/flash";
import { logger } from "@/lib/logger";
import { claimMemberByToken } from "@/lib/units/service";

export async function claimAction(formData: FormData): Promise<void> {
  const auth = await getAuthAndUser();
  const token = String(formData.get("token") ?? "");
  if (!auth || auth.disabled) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/units/claim/${token}`)}`);
  }
  if (!token) redirect("/units");

  const result = await claimMemberByToken({ token, userId: auth.user.id });
  if (!result.ok) {
    await setFlash(result.reason, "error");
    redirect("/units");
  }
  logger.info({ userId: auth.user.id, unitId: result.unitId }, "roster entry claimed");
  await setFlash("You're on the roster");
  redirect(`/units/${result.unitId}`);
}
