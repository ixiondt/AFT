"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { loadActivePlan } from "@/lib/aft/plan-service";
import { logWeight } from "@/lib/aft/weight-service";
import { setFlash } from "@/lib/flash";

function parseInches(value: FormDataEntryValue | null): number | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return undefined;
  return Math.round(n * 10) / 10;
}

export async function setHeightAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const raw = String(formData.get("heightIn") ?? "").trim();
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 48 || n > 96) {
    await setFlash("Height must be 48-96 inches", "error");
    revalidatePath("/body");
    return;
  }

  await db
    .update(schema.profiles)
    .set({ heightIn: Math.round(n), updatedAt: new Date() })
    .where(eq(schema.profiles.userId, session.user.id));

  await setFlash("Height saved");
  revalidatePath("/body");
}

export async function logBodyMetricsAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const planRow = await loadActivePlan(session.user.id);
  const weightRaw = String(formData.get("weightLb") ?? "");
  const weightLb = Number.parseInt(weightRaw, 10);

  if (!Number.isInteger(weightLb)) {
    await setFlash("Enter a weight", "error");
    revalidatePath("/body");
    return;
  }

  const measurements = {
    waistIn: parseInches(formData.get("waistIn")),
    neckIn: parseInches(formData.get("neckIn")),
    hipIn: parseInches(formData.get("hipIn")),
    abdomenIn: parseInches(formData.get("abdomenIn")),
  };

  const notes = String(formData.get("notes") ?? "").trim();

  const result = await logWeight({
    userId: session.user.id,
    planId: planRow?.id ?? null,
    weightLb,
    measurements,
    ...(notes ? { notes } : {}),
  });

  if (result.ok) {
    await setFlash(`Logged ${weightLb} lb`);
  } else {
    await setFlash(result.error, "error");
  }
  revalidatePath("/body");
  revalidatePath("/plan");
  revalidatePath("/progress");
  revalidatePath("/dashboard");
}
