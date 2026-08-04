"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  PROFILE_FORM_SCHEMA,
  checkboxValue,
  equipmentEnum,
  eventEnum,
  injuryEnum,
  multiValue,
  restrictionEnum,
} from "@/lib/aft/schemas";
import { persistGeneratedPlan } from "@/lib/aft/plan-service";

/** Server action: validate the profile form, generate + persist the plan, redirect. */
export async function generatePlanAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const equipment = multiValue(formData, "equipment").filter(
    (v): v is import("zod").infer<typeof equipmentEnum> =>
      equipmentEnum.safeParse(v).success,
  );
  const injuries = multiValue(formData, "injuries").filter(
    (v): v is import("zod").infer<typeof injuryEnum> =>
      injuryEnum.safeParse(v).success,
  );
  const restrictions = multiValue(formData, "restrictions").filter(
    (v): v is import("zod").infer<typeof restrictionEnum> =>
      restrictionEnum.safeParse(v).success,
  );
  const exemptEvents = multiValue(formData, "exemptEvents").filter(
    (v): v is import("zod").infer<typeof eventEnum> =>
      eventEnum.safeParse(v).success,
  );

  const parsed = PROFILE_FORM_SCHEMA.safeParse({
    age: formData.get("age"),
    sex: formData.get("sex"),
    bodyweightLb: formData.get("bodyweightLb"),
    goalBodyweightLb: formData.get("goalBodyweightLb"),
    heightIn: formData.get("heightIn"),
    daysPerWeek: formData.get("daysPerWeek"),
    durationWeeks: formData.get("durationWeeks"),
    testDate: formData.get("testDate"),
    equipment,
    injuries,
    calisthenicsPreferred: checkboxValue(formData, "calisthenicsPreferred"),
    activeRecovery: checkboxValue(formData, "activeRecovery"),
    hasMedicalProfile: checkboxValue(formData, "hasMedicalProfile"),
    profileType: formData.get("profileType") || undefined,
    profileStart: formData.get("profileStart"),
    profileExpires: formData.get("profileExpires"),
    restrictions,
    exemptEvents,
    alternateAerobic: formData.get("alternateAerobic") ?? "none",
    currentAlternateResult: formData.get("currentAlternateResult") || undefined,
    liftLimitLb: formData.get("liftLimitLb"),
    profileNotes: formData.get("profileNotes"),
    currentMdlLb: formData.get("currentMdlLb"),
    currentHrpReps: formData.get("currentHrpReps"),
    currentSdc: formData.get("currentSdc"),
    currentPlk: formData.get("currentPlk"),
    current2MR: formData.get("current2MR"),
    goalMdlLb: formData.get("goalMdlLb"),
    goalHrpReps: formData.get("goalHrpReps"),
    goalSdc: formData.get("goalSdc"),
    goalPlk: formData.get("goalPlk"),
    goal2MR: formData.get("goal2MR"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue ? `${issue.path.join(".")}: ${issue.message}` : "invalid input";
    redirect(`/profile?error=${encodeURIComponent(message)}`);
  }

  try {
    await persistGeneratedPlan({ userId: session.user.id, form: parsed.data });
  } catch (err) {
    logger.error(
      { err: (err as Error).message, userId: session.user.id },
      "plan generation failed",
    );
    redirect(`/profile?error=${encodeURIComponent("Could not generate plan. Try again.")}`);
  }
  redirect("/plan");
}
