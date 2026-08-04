"use server";

import { redirect } from "next/navigation";
import { getAuthAndUser } from "@/lib/auth";
import { setFlash } from "@/lib/flash";
import { logger } from "@/lib/logger";
import { CREATE_UNIT_SCHEMA } from "@/lib/units/schemas";
import { createUnit } from "@/lib/units/service";

export async function createUnitAction(formData: FormData): Promise<void> {
  const auth = await getAuthAndUser();
  if (!auth || auth.disabled) redirect("/signin");

  const parsed = CREATE_UNIT_SCHEMA.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    await setFlash(parsed.error.issues[0]?.message ?? "Invalid unit name", "error");
    redirect("/units");
  }

  let unitId: string;
  try {
    const unit = await createUnit({ ownerUserId: auth.user.id, name: parsed.data.name });
    unitId = unit.id;
  } catch (err) {
    // Postgres unique_violation → duplicate name for this owner.
    if ((err as { code?: string }).code === "23505") {
      await setFlash(`You already have a unit named "${parsed.data.name}"`, "error");
      redirect("/units");
    }
    logger.error({ err: (err as Error).message, userId: auth.user.id }, "create unit failed");
    await setFlash("Could not create unit. Try again.", "error");
    redirect("/units");
  }
  redirect(`/units/${unitId}`);
}
