"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadActivePlan } from "@/lib/aft/plan-service";
import { deleteWeightEntry, logWeight } from "@/lib/aft/weight-service";
import { setFlash } from "@/lib/flash";

export async function logWeightAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const planRow = await loadActivePlan(session.user.id);
  const planId = planRow?.id ?? null;

  const raw = String(formData.get("weightLb") ?? "");
  const weightLb = Number.parseInt(raw, 10);
  const notes = String(formData.get("notes") ?? "").trim();

  const result = await logWeight({
    userId: session.user.id,
    planId,
    weightLb,
    ...(notes ? { notes } : {}),
  });
  if (result.ok) {
    await setFlash(`Logged ${weightLb} lb`);
  } else {
    await setFlash(result.error, "error");
  }

  revalidatePath("/plan");
  revalidatePath("/body");
  revalidatePath("/progress");
}

export async function deleteWeightAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) return;
  await deleteWeightEntry({ userId: session.user.id, entryId });
  revalidatePath("/plan");
  revalidatePath("/body");
  revalidatePath("/progress");
}
