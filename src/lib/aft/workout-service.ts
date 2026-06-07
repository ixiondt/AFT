import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { ExerciseRow, SessionPrescription } from "@/lib/planner";

/** One row per actual set, if the user logged per-set. */
export type ActualSet = {
  weightLb?: number;
  reps?: string;
};

export type ActualExercise = {
  name: string;
  /** Per-set rows. If absent, fall back to the single weight/reps fields. */
  setRows?: ActualSet[];
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

/**
 * Parse a per-exercise actuals form into an ActualExercise[] keyed by prescription.
 *
 * Looks for both per-set inputs (`ex_${i}_set_${j}_weight`) and the old single-
 * weight/reps fields. Per-set values, if present, populate setRows. Single
 * fields stay as a quick override / aggregate.
 */
export function parseActualsFromForm(
  prescription: SessionPrescription,
  formData: FormData,
): { exercises: ActualExercise[] } | undefined {
  const exercises: ActualExercise[] = [];
  let any = false;

  prescription.main.forEach((row: ExerciseRow, i: number) => {
    const skipped = formData.get(`ex_${i}_skipped`) === "on";
    const notes = String(formData.get(`ex_${i}_notes`) ?? "").trim();

    const ex: ActualExercise = { name: row.name };

    // Per-set inputs (preferred shape going forward).
    const setRows: ActualSet[] = [];
    for (let j = 0; j < row.sets; j++) {
      const w = String(formData.get(`ex_${i}_set_${j}_weight`) ?? "").trim();
      const r = String(formData.get(`ex_${i}_set_${j}_reps`) ?? "").trim();
      const set: ActualSet = {};
      if (w) {
        const n = Number.parseFloat(w);
        if (Number.isFinite(n) && n >= 0) set.weightLb = Math.round(n);
      }
      if (r) set.reps = r.slice(0, 40);
      setRows.push(set);
    }
    const anySetData = setRows.some(
      (s) => s.weightLb !== undefined || s.reps !== undefined,
    );
    if (anySetData) ex.setRows = setRows;

    // Aggregate fallback fields — older forms still send these.
    const aggW = String(formData.get(`ex_${i}_weight`) ?? "").trim();
    const aggR = String(formData.get(`ex_${i}_reps`) ?? "").trim();
    if (aggW) {
      const w = Number.parseFloat(aggW);
      if (Number.isFinite(w) && w >= 0) ex.actualWeightLb = Math.round(w);
    }
    if (aggR) ex.actualReps = aggR.slice(0, 40);

    if (skipped) ex.skipped = true;
    if (notes) ex.notes = notes.slice(0, 300);

    if (
      ex.setRows ||
      ex.actualWeightLb !== undefined ||
      ex.actualReps ||
      ex.skipped ||
      ex.notes
    ) {
      any = true;
    }
    exercises.push(ex);
  });

  return any ? { exercises } : undefined;
}
