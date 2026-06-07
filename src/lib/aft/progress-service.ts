import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Plan, SessionPrescription } from "@/lib/planner";
import { loadWeightLog, type WeightLogEntry } from "./weight-service";

type ActualExercise = {
  name: string;
  actualWeightLb?: number;
  actualReps?: string;
  skipped?: boolean;
  notes?: string;
};

type WorkoutRow = {
  weekIndex: number;
  dayOfWeek: number;
  sessionType: string;
  prescription: SessionPrescription;
  actuals: { exercises?: ActualExercise[] } | null;
  rpe: number | null;
  completedAt: Date | null;
};

export type WeeklyPoint = {
  weekIndex: number;
  value: number | null;
};

export type ProgressSnapshot = {
  weightLog: WeightLogEntry[];
  startingWeightLb: number | null;
  /** Completion: { weekIndex, prescribed (non-rest days), completed }. */
  completion: Array<{ weekIndex: number; prescribed: number; completed: number }>;
  /** Mean RPE per week (only weeks with any RPE entries). */
  rpe: WeeklyPoint[];
  /** Highest weight logged on any "deadlift" exercise that week. */
  mdlMax: WeeklyPoint[];
  /** Highest single-set rep count logged on any "hand-release" or HRP exercise that week. */
  hrpMax: WeeklyPoint[];
  /** Highest plank-hold actual (parsed mm:ss → seconds) per week if logged. */
  plkMax: WeeklyPoint[];
  /** Number of logged actuals (for empty-state messaging). */
  totalActuals: number;
};

function parseTimeReps(input: string | undefined): number | undefined {
  if (!input) return undefined;
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(input);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = Number(input);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const isDeadlift = (name: string) => /dead\s*lift|deadlift/i.test(name);
const isHrp = (name: string) =>
  /hand[-\s]?release|HRP\b|push[-\s]?up/i.test(name);
const isPlank = (name: string) =>
  /plank/i.test(name);

export async function loadProgressSnapshot(args: {
  userId: string;
  planId: string;
  plan: Plan;
}): Promise<ProgressSnapshot> {
  const { userId, planId, plan } = args;

  const [weightLog, workoutRows] = await Promise.all([
    loadWeightLog({ userId, planId }),
    db.query.workouts.findMany({
      where: and(
        eq(schema.workouts.userId, userId),
        eq(schema.workouts.planId, planId),
      ),
    }),
  ]);

  const workouts: WorkoutRow[] = workoutRows.map((w) => ({
    weekIndex: w.weekIndex,
    dayOfWeek: w.dayOfWeek,
    sessionType: w.sessionType,
    prescription: w.prescription as SessionPrescription,
    actuals: (w.actuals ?? null) as { exercises?: ActualExercise[] } | null,
    rpe: w.rpe,
    completedAt: w.completedAt,
  }));

  // Build per-week scaffolding
  const weeks = plan.weeks.map((w) => w.weekIndex);

  // Completion: count non-rest scheduled days vs completed workouts
  const completion = weeks.map((wi) => {
    const week = plan.weeks[wi]!;
    const prescribed = week.days.filter(
      (d) => d.session.sessionType !== "rest" && d.session.sessionType !== "recovery",
    ).length;
    const completed = workouts.filter(
      (w) => w.weekIndex === wi && w.completedAt !== null,
    ).length;
    return { weekIndex: wi, prescribed, completed };
  });

  // RPE: average per week
  const rpe: WeeklyPoint[] = weeks.map((wi) => {
    const values = workouts
      .filter((w) => w.weekIndex === wi && typeof w.rpe === "number")
      .map((w) => w.rpe!);
    return {
      weekIndex: wi,
      value: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
    };
  });

  const mdlMax = perWeekActualMax(workouts, weeks, isDeadlift, "weight");
  const hrpMax = perWeekActualMax(workouts, weeks, isHrp, "reps");
  const plkMax = perWeekActualMax(workouts, weeks, isPlank, "timeSec");

  const totalActuals = workouts.reduce(
    (acc, w) => acc + (w.actuals?.exercises?.length ?? 0),
    0,
  );

  return {
    weightLog,
    startingWeightLb: plan.input.bodyweightLb,
    completion,
    rpe,
    mdlMax,
    hrpMax,
    plkMax,
    totalActuals,
  };
}

function perWeekActualMax(
  workouts: readonly WorkoutRow[],
  weeks: readonly number[],
  matcher: (name: string) => boolean,
  kind: "weight" | "reps" | "timeSec",
): WeeklyPoint[] {
  return weeks.map((wi) => {
    let max: number | null = null;
    for (const w of workouts) {
      if (w.weekIndex !== wi) continue;
      const exs = w.actuals?.exercises ?? [];
      for (let i = 0; i < exs.length; i++) {
        const act = exs[i]!;
        const presc = w.prescription.main[i];
        const name = act.name || presc?.name || "";
        if (!matcher(name)) continue;
        if (act.skipped) continue;

        let value: number | undefined;
        if (kind === "weight") value = act.actualWeightLb;
        else if (kind === "reps") {
          const n = Number(act.actualReps);
          if (Number.isFinite(n)) value = n;
        } else if (kind === "timeSec") {
          value = parseTimeReps(act.actualReps);
        }
        if (typeof value === "number" && (max === null || value > max)) {
          max = value;
        }
      }
    }
    return { weekIndex: wi, value: max };
  });
}
