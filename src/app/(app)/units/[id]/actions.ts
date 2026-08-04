"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUnitAccess } from "@/lib/auth";
import {
  checkboxValue,
  eventEnum,
  multiValue,
  restrictionEnum,
} from "@/lib/aft/schemas";
import { setFlash } from "@/lib/flash";
import { logger } from "@/lib/logger";
import { MEMBER_SCHEMA } from "@/lib/units/schemas";
import { addMember, removeMember, updateMember } from "@/lib/units/service";

/** Build the MEMBER_SCHEMA input object from raw FormData. */
function readMemberForm(formData: FormData) {
  const restrictions = multiValue(formData, "restrictions").filter(
    (v): v is import("zod").infer<typeof restrictionEnum> =>
      restrictionEnum.safeParse(v).success,
  );
  const exemptEvents = multiValue(formData, "exemptEvents").filter(
    (v): v is import("zod").infer<typeof eventEnum> => eventEnum.safeParse(v).success,
  );
  return {
    displayName: formData.get("displayName"),
    role: formData.get("role") || "member",
    age: formData.get("age"),
    sex: formData.get("sex") || undefined,
    bodyweightLb: formData.get("bodyweightLb"),
    heightIn: formData.get("heightIn"),
    mdlLb: formData.get("mdlLb"),
    hrpReps: formData.get("hrpReps"),
    sdcSec: formData.get("sdcSec"),
    plkSec: formData.get("plkSec"),
    twoMileSec: formData.get("twoMileSec"),
    hasMedicalProfile: checkboxValue(formData, "hasMedicalProfile"),
    profileType: formData.get("profileType") || undefined,
    profileStart: formData.get("profileStart"),
    profileExpires: formData.get("profileExpires"),
    restrictions,
    exemptEvents,
    alternateAerobic: formData.get("alternateAerobic") || "none",
    alternateResult: formData.get("alternateResult") || undefined,
    liftLimitLb: formData.get("liftLimitLb"),
    profileNotes: formData.get("profileNotes"),
  };
}

export async function addMemberAction(formData: FormData): Promise<void> {
  const unitId = String(formData.get("unitId") ?? "");
  await requireUnitAccess(unitId, ["mft"]);

  const parsed = MEMBER_SCHEMA.safeParse(readMemberForm(formData));
  if (!parsed.success) {
    await setFlash(
      parsed.error.issues[0]?.message ?? "Check the member details",
      "error",
    );
    revalidatePath(`/units/${unitId}`);
    return;
  }

  try {
    await addMember({ unitId, input: parsed.data });
    await setFlash("Member added");
  } catch (err) {
    logger.error({ err: (err as Error).message, unitId }, "add member failed");
    await setFlash("Could not add member", "error");
  }
  revalidatePath(`/units/${unitId}`);
}

export async function updateMemberAction(formData: FormData): Promise<void> {
  const unitId = String(formData.get("unitId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  await requireUnitAccess(unitId, ["mft"]);

  const parsed = MEMBER_SCHEMA.safeParse(readMemberForm(formData));
  if (!parsed.success) {
    await setFlash(parsed.error.issues[0]?.message ?? "Check the details", "error");
    revalidatePath(`/units/${unitId}`);
    return;
  }

  const ok = await updateMember({ unitId, memberId, input: parsed.data });
  await setFlash(ok ? "Member updated" : "Member not found", ok ? "ok" : "error");
  revalidatePath(`/units/${unitId}`);
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const unitId = String(formData.get("unitId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  await requireUnitAccess(unitId, ["mft"]);

  await removeMember({ unitId, memberId });
  await setFlash("Member removed");
  revalidatePath(`/units/${unitId}`);
}
