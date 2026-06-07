import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { ExerciseRow, SessionPrescription } from "@/lib/planner";

export type ActualExercise = {
  name: string;
  actualWeightLb?: number;
  actualReps?: string;
  skipped?: boolean;
  notes?: string;
};

export type WorkoutLog = {
  id: string;
  planId: string;
  weekIndex: number;
  dayOfWeek: number;
  sessionType: string;
  completedAt: string | null; // ISO
  rpe: number | null;
  actuals: { exercises?: ActualExercise[] } | null;
  notes: string | null;
};

export async function loadWorkoutsForPlan(args: {
  userId: string;
  planId: string;
}): Promise<Map<string, WorkoutLog>> {
  const rows = await db.query.workouts.findMany({
    where: and(
      eq(schema.workouts.userId, args.userId),
      eq(schema.workouts.planId, args.planId),
    ),
  });
  const map = new Map<string, WorkoutLog>();
  for (const r of rows) {
    map.set(`${r.weekIndex}-${r.dayOfWeek}`, {
      id: r.id,
      planId: r.planId,
      weekIndex: r.weekIndex,
      dayOfWeek: r.dayOfWeek,
      sessionType: r.sessionType,
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      rpe: r.rpe,
      actuals: r.actuals ?? null,
      notes: r.completedNotes,
    });
  }
  return map;
}

/** Upsert a workout row keyed by (planId, weekIndex, dayOfWeek). */
export async function upsertWorkout(args: {
  userId: string;
  planId: string;
  weekIndex: number;
  dayOfWeek: number;
  prescription: SessionPrescription;
  completed: boolean;
  actuals?: { exercises: ActualExercise[] };
  rpe?: number;
  notes?: string;
}): Promise<void> {
  const completedAt = args.completed ? new Date() : null;
  await db
    .insert(schema.workouts)
    .values({
      userId: args.userId,
      planId: args.planId,
      weekIndex: args.weekIndex,
      dayOfWeek: args.dayOfWeek,
      sessionType: args.prescription.sessionType,
      prescription: args.prescription,
      ...(args.actuals ? { actuals: args.actuals } : {}),
      ...(typeof args.rpe === "number" ? { rpe: args.rpe } : {}),
      ...(args.notes ? { completedNotes: args.notes } : {}),
      completedAt,
    })
    .onConflictDoUpdate({
      target: [
        schema.workouts.planId,
        schema.workouts.weekIndex,
        schema.workouts.dayOfWeek,
      ],
      set: {
        prescription: args.prescription,
        sessionType: args.prescription.sessionType,
        ...(args.actuals ? { actuals: args.actuals } : {}),
        ...(typeof args.rpe === "number" ? { rpe: args.rpe } : {}),
        ...(args.notes ? { completedNotes: args.notes } : {}),
        completedAt,
      },
    });
}

/** Parse a per-exercise actuals form into an ActualExercise[] keyed by prescription. */
export function parseActualsFromForm(
  prescription: SessionPrescription,
  formData: FormData,
): { exercises: ActualExercise[] } | undefined {
  const exercises: ActualExercise[] = [];
  let any = false;
  prescription.main.forEach((row: ExerciseRow, i: number) => {
    const rawWeight = String(formData.get(`ex_${i}_weight`) ?? "").trim();
    const rawReps = String(formData.get(`ex_${i}_reps`) ?? "").trim();
    const skipped = formData.get(`ex_${i}_skipped`) === "on";
    const notes = String(formData.get(`ex_${i}_notes`) ?? "").trim();

    const ex: ActualExercise = { name: row.name };
    if (rawWeight) {
      const w = Number.parseFloat(rawWeight);
      if (Number.isFinite(w) && w >= 0) ex.actualWeightLb = Math.round(w);
    }
    if (rawReps) ex.actualReps = rawReps.slice(0, 40);
    if (skipped) ex.skipped = true;
    if (notes) ex.notes = notes.slice(0, 300);

    if (ex.actualWeightLb !== undefined || ex.actualReps || ex.skipped || ex.notes) {
      any = true;
    }
    exercises.push(ex);
  });
  return any ? { exercises } : undefined;
}
