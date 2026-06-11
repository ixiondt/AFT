"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadActivePlan } from "@/lib/aft/plan-service";
import {
  parseActualsFromForm,
  upsertWorkout,
} from "@/lib/aft/workout-service";
import { setFlash } from "@/lib/flash";
import type { Plan, SessionPrescription } from "@/lib/planner";

function sessionFor(plan: Plan, weekIndex: number, dayOfWeek: number): SessionPrescription | null {
  const week = plan.weeks[weekIndex];
  if (!week) return null;
  const day = week.days.find((d) => d.dayOfWeek === dayOfWeek);
  return day?.session ?? null;
}

export async function markWorkoutAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const planRow = await loadActivePlan(session.user.id);
  if (!planRow) redirect("/profile");

  const weekIndex = Number.parseInt(String(formData.get("weekIndex") ?? ""), 10);
  const dayOfWeek = Number.parseInt(String(formData.get("dayOfWeek") ?? ""), 10);
  const action = String(formData.get("action") ?? "");
  if (!Number.isInteger(weekIndex) || !Number.isInteger(dayOfWeek)) return;

  const prescription = sessionFor(planRow.payload as Plan, weekIndex, dayOfWeek);
  if (!prescription) return;

  const completed = action !== "unmark";
  await upsertWorkout({
    userId: session.user.id,
    planId: planRow.id,
    weekIndex,
    dayOfWeek,
    prescription,
    completed,
  });

  await setFlash(completed ? "Workout marked done" : "Completion cleared");
  revalidatePath("/plan");
  revalidatePath("/calendar");
  revalidatePath("/progress");
  revalidatePath("/dashboard");
}

export async function logWorkoutDetailsAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const planRow = await loadActivePlan(session.user.id);
  if (!planRow) redirect("/profile");

  const weekIndex = Number.parseInt(String(formData.get("weekIndex") ?? ""), 10);
  const dayOfWeek = Number.parseInt(String(formData.get("dayOfWeek") ?? ""), 10);
  if (!Number.isInteger(weekIndex) || !Number.isInteger(dayOfWeek)) return;

  const prescription = sessionFor(planRow.payload as Plan, weekIndex, dayOfWeek);
  if (!prescription) return;

  const actuals = parseActualsFromForm(prescription, formData);
  const rpeRaw = String(formData.get("rpe") ?? "").trim();
  const rpe = rpeRaw ? Number.parseInt(rpeRaw, 10) : NaN;
  const notes = String(formData.get("notes") ?? "").trim();

  await upsertWorkout({
    userId: session.user.id,
    planId: planRow.id,
    weekIndex,
    dayOfWeek,
    prescription,
    completed: true,
    ...(actuals ? { actuals } : {}),
    ...(Number.isInteger(rpe) && rpe >= 1 && rpe <= 10 ? { rpe } : {}),
    ...(notes ? { notes } : {}),
  });

  await setFlash("Workout details saved");
  revalidatePath("/plan");
  revalidatePath("/calendar");
  revalidatePath("/progress");
  revalidatePath("/dashboard");
}
