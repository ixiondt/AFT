import { cache } from "react";
import { ageToBracket } from "@/lib/scoring";
import { generatePlan, type Plan, type PlanInput } from "@/lib/planner";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { generateNarrative } from "@/lib/groq/narrative";
import { logger } from "@/lib/logger";
import type { ProfileFormInput } from "./schemas";

/** Map the validated form input to a PlanInput, normalizing fields. */
export function formToPlanInput(form: ProfileFormInput): PlanInput {
  return {
    age: form.age,
    sex: form.sex,
    bodyweightLb: form.bodyweightLb,
    ...(form.goalBodyweightLb ? { goalBodyweightLb: form.goalBodyweightLb } : {}),
    daysPerWeek: form.daysPerWeek as 3 | 4 | 5 | 6,
    durationWeeks: form.durationWeeks,
    equipment: form.equipment,
    injuries: form.injuries,
    preferences: {
      calisthenicsPreferred: form.calisthenicsPreferred,
      activeRecovery: form.activeRecovery,
    },
    ...(form.hasMedicalProfile
      ? {
          profile: {
            restrictions: form.restrictions,
            exemptEvents: form.exemptEvents,
            alternateAerobic: form.alternateAerobic,
            ...(form.liftLimitLb !== undefined ? { liftLimitLb: form.liftLimitLb } : {}),
          },
        }
      : {}),
    current: {
      MDL: form.currentMdlLb,
      HRP: form.currentHrpReps,
      SDC: form.currentSdc,
      PLK: form.currentPlk,
      "2MR": form.current2MR,
    },
    goal: {
      MDL: form.goalMdlLb,
      HRP: form.goalHrpReps,
      SDC: form.goalSdc,
      PLK: form.goalPlk,
      "2MR": form.goal2MR,
    },
    testDate: form.testDate,
  };
}

/**
 * Persist a generated plan for a user: deactivate any old active plan/goal,
 * insert profile (upsert), insert baseline aft_test, insert goal, insert plan.
 */
export async function persistGeneratedPlan(args: {
  userId: string;
  form: ProfileFormInput;
}): Promise<{ planId: string }> {
  const { userId, form } = args;
  const planInput = formToPlanInput(form);
  let plan: Plan = generatePlan(planInput, new Date());

  // Best-effort narrative enrichment. If Groq is unconfigured or fails, we still
  // ship the deterministic plan.
  const narrative = await generateNarrative(plan, userId);
  if (narrative) {
    plan = { ...plan, narrative };
    logger.info({ userId }, "narrative attached to plan");
  } else {
    logger.debug({ userId }, "no narrative — deterministic plan only");
  }

  // Upsert profile
  await db
    .insert(schema.profiles)
    .values({
      userId,
      age: form.age,
      sex: form.sex,
      bodyweightLb: form.bodyweightLb,
      ...(form.heightIn ? { heightIn: form.heightIn } : {}),
      daysPerWeek: form.daysPerWeek,
      equipment: form.equipment as string[],
      injuries: form.injuries as string[],
    })
    .onConflictDoUpdate({
      target: schema.profiles.userId,
      set: {
        age: form.age,
        sex: form.sex,
        bodyweightLb: form.bodyweightLb,
        ...(form.heightIn ? { heightIn: form.heightIn } : {}),
        daysPerWeek: form.daysPerWeek,
        equipment: form.equipment as string[],
        injuries: form.injuries as string[],
        updatedAt: new Date(),
      },
    });

  // Upsert medical profile: deactivate any prior active one, then insert the
  // new active profile if the form declares one. (One active profile per user.)
  await db
    .update(schema.medicalProfiles)
    .set({ active: false, updatedAt: new Date() })
    .where(
      and(
        eq(schema.medicalProfiles.userId, userId),
        eq(schema.medicalProfiles.active, true),
      ),
    );
  if (form.hasMedicalProfile && form.profileType) {
    await db.insert(schema.medicalProfiles).values({
      userId,
      profileType: form.profileType,
      startDate: form.profileStart ? new Date(form.profileStart) : null,
      expiresAt: form.profileExpires ? new Date(form.profileExpires) : null,
      exemptEvents: form.exemptEvents as string[],
      alternateAerobic: form.alternateAerobic,
      restrictions: form.restrictions as string[],
      liftLimitLb: form.liftLimitLb ?? null,
      notes: form.profileNotes ?? null,
      active: true,
    });
  }

  // Insert baseline test
  const bracket = ageToBracket(form.age);
  const [test] = await db
    .insert(schema.aftTests)
    .values({
      userId,
      testedAt: new Date(),
      label: "baseline",
      mdlLb: form.currentMdlLb,
      hrpReps: form.currentHrpReps,
      sdcSec: form.currentSdc,
      plkSec: form.currentPlk,
      twoMileSec: form.current2MR,
      bracketSnapshot: bracket,
      sexSnapshot: form.sex,
      totalPoints: plan.currentTotal,
    })
    .returning({ id: schema.aftTests.id });
  if (!test) throw new Error("Failed to insert baseline test");

  // Deactivate any prior active goal + plan
  await db
    .update(schema.goals)
    .set({ active: false })
    .where(and(eq(schema.goals.userId, userId), eq(schema.goals.active, true)));
  await db
    .update(schema.plans)
    .set({ active: false })
    .where(and(eq(schema.plans.userId, userId), eq(schema.plans.active, true)));

  const [goal] = await db
    .insert(schema.goals)
    .values({
      userId,
      testDate: new Date(form.testDate),
      goalMdlLb: form.goalMdlLb,
      goalHrpReps: form.goalHrpReps,
      goalSdcSec: form.goalSdc,
      goalPlkSec: form.goalPlk,
      goalTwoMileSec: form.goal2MR,
      goalTotal: plan.goalTotal,
      active: true,
    })
    .returning({ id: schema.goals.id });
  if (!goal) throw new Error("Failed to insert goal");

  const [planRow] = await db
    .insert(schema.plans)
    .values({
      userId,
      goalId: goal.id,
      baselineTestId: test.id,
      durationWeeks: form.durationWeeks,
      startDate: new Date(),
      payload: plan,
      active: true,
    })
    .returning({ id: schema.plans.id });
  if (!planRow) throw new Error("Failed to insert plan");

  return { planId: planRow.id };
}

/**
 * Load the active plan for a user.
 *
 * Wrapped in React's `cache()` so multiple callers in the same request
 * (typically layout + page + a section component) share one DB read +
 * one JSONB parse instead of N. Per-request memo only — does NOT leak
 * across requests.
 */
export const loadActivePlan = cache(async (userId: string) => {
  const row = await db.query.plans.findFirst({
    where: (p, { and, eq }) => and(eq(p.userId, userId), eq(p.active, true)),
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });
  return row ?? null;
});
