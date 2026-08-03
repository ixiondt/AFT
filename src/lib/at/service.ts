import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Event, RawScores } from "@/lib/scoring/types";
import type {
  AlternateAerobic,
  ProfileAccommodation,
  RestrictionCode,
} from "@/lib/planner/types";
import type { RosterMember } from "@/lib/units/service";
import { getUnitRoster } from "@/lib/units/service";
import { generateAtPlan, type AtMemberInput, type AtPlan } from "./index";

/** Map a roster row (+ its active medical profile) to the AT engine's input. */
export function memberToAtInput(m: RosterMember): AtMemberInput {
  const hasFullBaseline =
    m.age != null &&
    m.sex != null &&
    m.mdlLb != null &&
    m.hrpReps != null &&
    m.sdcSec != null &&
    m.plkSec != null &&
    m.twoMileSec != null;

  const baseline: RawScores | null = hasFullBaseline
    ? {
        MDL: m.mdlLb as number,
        HRP: m.hrpReps as number,
        SDC: m.sdcSec as number,
        PLK: m.plkSec as number,
        "2MR": m.twoMileSec as number,
      }
    : null;

  const mp = m.medicalProfile;
  const profile: ProfileAccommodation | undefined = mp
    ? {
        restrictions: (mp.restrictions ?? []) as RestrictionCode[],
        exemptEvents: (mp.exemptEvents ?? []) as Event[],
        alternateAerobic: mp.alternateAerobic as AlternateAerobic,
        ...(mp.liftLimitLb != null ? { liftLimitLb: mp.liftLimitLb } : {}),
      }
    : undefined;

  return {
    id: m.id,
    displayName: m.displayName,
    age: m.age,
    sex: m.sex,
    baseline,
    twoMileSec: m.twoMileSec,
    mdlLb: m.mdlLb,
    ...(profile ? { profile } : {}),
  };
}

/**
 * Build + persist an AT plan for a unit. Records the AT window on the unit,
 * deactivates any prior active plan, inserts the new one. Returns the plan id.
 */
export async function generateAndSaveAtPlan(args: {
  unitId: string;
  unitName: string;
  startDateISO: string;
  days: number;
}): Promise<{ atPlanId: string; plan: AtPlan }> {
  const roster = await getUnitRoster(args.unitId);
  const plan = generateAtPlan(
    {
      unitName: args.unitName,
      startDateISO: args.startDateISO,
      days: args.days,
      members: roster.map(memberToAtInput),
    },
    new Date(),
  );

  const startDate = new Date(`${args.startDateISO}T00:00:00Z`);

  await db
    .update(schema.units)
    .set({ atStartDate: startDate, atDays: args.days, updatedAt: new Date() })
    .where(eq(schema.units.id, args.unitId));

  await db
    .update(schema.atPlans)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(schema.atPlans.unitId, args.unitId), eq(schema.atPlans.active, true)));

  const [row] = await db
    .insert(schema.atPlans)
    .values({
      unitId: args.unitId,
      name: `${args.unitName} — AT PT`,
      startDate,
      days: args.days,
      payload: plan,
      active: true,
    })
    .returning({ id: schema.atPlans.id });
  if (!row) throw new Error("Failed to save AT plan");

  return { atPlanId: row.id, plan };
}

export async function loadActiveAtPlan(unitId: string) {
  const row = await db.query.atPlans.findFirst({
    where: and(eq(schema.atPlans.unitId, unitId), eq(schema.atPlans.active, true)),
    orderBy: [desc(schema.atPlans.createdAt)],
  });
  return row ?? null;
}
