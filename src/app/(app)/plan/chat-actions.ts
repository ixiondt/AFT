"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadActivePlan } from "@/lib/aft/plan-service";
import { postChatMessage } from "@/lib/aft/chat-service";
import { setFlash } from "@/lib/flash";

export async function sendChatMessage(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const planRow = await loadActivePlan(session.user.id);
  if (!planRow) redirect("/profile");

  const message = String(formData.get("message") ?? "");
  const result = await postChatMessage({
    userId: session.user.id,
    planId: planRow.id,
    message,
  });
  if (!result.ok) {
    await setFlash(result.error, "error");
  }

  revalidatePath("/plan");
}
