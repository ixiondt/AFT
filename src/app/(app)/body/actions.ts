"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { loadActivePlan } from "@/lib/aft/plan-service";
import { logWeight } from "@/lib/aft/weight-service";
import {
  averageWaist,
  roundDownHalfInch,
  roundNearestHalfInch,
} from "@/lib/aft/body-comp";
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
    .set({ heightIn: roundNearestHalfInch(n), updatedAt: new Date() })
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

  // Waist is measured at the navel three times, each rounded DOWN to the
  // nearest 0.5" (TAPE team guidance / DA 5500). We store the individual
  // readings plus the average so the DA 5500 export and WHtR can be recomputed.
  const readings = [1, 2, 3]
    .map((i) => parseInches(formData.get(`waist${i}`)))
    .filter((n): n is number => typeof n === "number")
    .map(roundDownHalfInch);

  let measurements:
    | { waistIn?: number; waistReadings?: number[] }
    | undefined;
  if (readings.length >= 3) {
    const avg = averageWaist(readings);
    measurements = { waistReadings: readings, waistIn: avg ?? readings[0] };
  } else if (readings.length >= 1) {
    // 1–2 readings: keep the mean as the single waist value (no DA average yet).
    const mean = readings.reduce((s, v) => s + v, 0) / readings.length;
    measurements = { waistIn: Math.round(mean * 1000) / 1000 };
  }

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
