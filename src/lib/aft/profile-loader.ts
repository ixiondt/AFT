import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { secToMmss } from "@/lib/scoring";
import { loadWeightLog } from "./weight-service";

export type InitialFormValues = {
  age?: string;
  sex?: "MC" | "F" | "";
  bodyweightLb?: string;
  goalBodyweightLb?: string;
  heightIn?: string;
  daysPerWeek?: string;
  durationWeeks?: number;
  testDate?: string; // YYYY-MM-DD
  equipment?: readonly string[];
  injuries?: readonly string[];
  calisthenicsPreferred?: boolean;
  activeRecovery?: boolean;
  current?: { mdl: string; hrp: string; sdc: string; plk: string; mr2: string };
  goal?: { mdl: string; hrp: string; sdc: string; plk: string; mr2: string };
  medicalProfile?: {
    hasMedicalProfile: boolean;
    profileType?: "temporary" | "permanent";
    profileStart?: string; // YYYY-MM-DD
    profileExpires?: string; // YYYY-MM-DD
    restrictions: string[];
    exemptEvents: string[];
    alternateAerobic: string;
    liftLimitLb?: string;
    profileNotes?: string;
  };
};

const blankRaw = { mdl: "", hrp: "", sdc: "", plk: "", mr2: "" } as const;

/** Load whatever a user has previously saved, normalized for form prefill. */
export async function loadInitialFormValues(userId: string): Promise<InitialFormValues> {
  const [profile, goal, latestTest, latestPlan, weightLog, medProfile] =
    await Promise.all([
      db.query.profiles.findFirst({ where: eq(schema.profiles.userId, userId) }),
      db.query.goals.findFirst({
        where: and(eq(schema.goals.userId, userId), eq(schema.goals.active, true)),
        orderBy: [desc(schema.goals.createdAt)],
      }),
      db.query.aftTests.findFirst({
        where: eq(schema.aftTests.userId, userId),
        orderBy: [desc(schema.aftTests.testedAt)],
      }),
      db.query.plans.findFirst({
        where: and(eq(schema.plans.userId, userId), eq(schema.plans.active, true)),
        orderBy: [desc(schema.plans.createdAt)],
      }),
      loadWeightLog({ userId }),
      db.query.medicalProfiles.findFirst({
        where: and(
          eq(schema.medicalProfiles.userId, userId),
          eq(schema.medicalProfiles.active, true),
        ),
        orderBy: [desc(schema.medicalProfiles.createdAt)],
      }),
    ]);

  const out: InitialFormValues = {};

  if (profile) {
    out.age = String(profile.age);
    out.sex = profile.sex;
    // Prefer the most recent weigh-in over the bodyweight captured at last
    // profile save — otherwise regenerating the plan re-uses a stale weight
    // and the MDL programming scales off the wrong number.
    const latestWeightLb = weightLog[weightLog.length - 1]?.weightLb;
    out.bodyweightLb = String(latestWeightLb ?? profile.bodyweightLb);
    if (profile.heightIn) out.heightIn = String(profile.heightIn);
    out.daysPerWeek = String(profile.daysPerWeek);
    out.equipment = (profile.equipment ?? []) as string[];
    out.injuries = (profile.injuries ?? []) as string[];
  }

  if (latestPlan) {
    out.durationWeeks = latestPlan.durationWeeks;
    // Preferences + goal bodyweight live in the plan payload; pull them for prefill.
    const payload = latestPlan.payload as
      | {
          input?: {
            goalBodyweightLb?: number;
            preferences?: { calisthenicsPreferred?: boolean; activeRecovery?: boolean };
          };
        }
      | null;
    const prefs = payload?.input?.preferences;
    if (prefs) {
      out.calisthenicsPreferred = Boolean(prefs.calisthenicsPreferred);
      out.activeRecovery = Boolean(prefs.activeRecovery);
    }
    if (typeof payload?.input?.goalBodyweightLb === "number") {
      out.goalBodyweightLb = String(payload.input.goalBodyweightLb);
    }
  }

  if (goal) {
    const d = new Date(goal.testDate);
    out.testDate = d.toISOString().slice(0, 10);
    out.goal = {
      mdl: String(goal.goalMdlLb),
      hrp: String(goal.goalHrpReps),
      sdc: secToMmss(goal.goalSdcSec),
      plk: secToMmss(goal.goalPlkSec),
      mr2: secToMmss(goal.goalTwoMileSec),
    };
  } else {
    out.goal = { ...blankRaw };
  }

  if (medProfile) {
    out.medicalProfile = {
      hasMedicalProfile: true,
      profileType: medProfile.profileType,
      ...(medProfile.startDate
        ? { profileStart: new Date(medProfile.startDate).toISOString().slice(0, 10) }
        : {}),
      ...(medProfile.expiresAt
        ? { profileExpires: new Date(medProfile.expiresAt).toISOString().slice(0, 10) }
        : {}),
      restrictions: (medProfile.restrictions ?? []) as string[],
      exemptEvents: (medProfile.exemptEvents ?? []) as string[],
      alternateAerobic: medProfile.alternateAerobic,
      ...(medProfile.liftLimitLb != null
        ? { liftLimitLb: String(medProfile.liftLimitLb) }
        : {}),
      ...(medProfile.notes ? { profileNotes: medProfile.notes } : {}),
    };
  } else {
    out.medicalProfile = {
      hasMedicalProfile: false,
      restrictions: [],
      exemptEvents: [],
      alternateAerobic: "none",
    };
  }

  if (latestTest) {
    out.current = {
      mdl: String(latestTest.mdlLb),
      hrp: String(latestTest.hrpReps),
      sdc: secToMmss(latestTest.sdcSec),
      plk: secToMmss(latestTest.plkSec),
      mr2: secToMmss(latestTest.twoMileSec),
    };
  } else {
    out.current = { ...blankRaw };
  }

  return out;
}
