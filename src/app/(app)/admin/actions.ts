"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isOwnerEmail, requireAdmin } from "@/lib/auth";
import { setFlash } from "@/lib/flash";
import { logger } from "@/lib/logger";

export async function setUserDisabledAction(formData: FormData): Promise<void> {
  const { user: admin } = await requireAdmin();
  const targetId = String(formData.get("userId") ?? "");
  const disabled = String(formData.get("disabled") ?? "") === "true";
  if (!targetId) return;

  const target = await db.query.users.findFirst({
    where: eq(schema.users.id, targetId),
  });
  if (!target) {
    await setFlash("User not found", "error");
    revalidatePath("/admin");
    return;
  }
  if (target.id === admin.id) {
    await setFlash("Can't lock your own account", "warn");
    revalidatePath("/admin");
    return;
  }
  if (isOwnerEmail(target.email)) {
    await setFlash("Can't lock the owner", "error");
    revalidatePath("/admin");
    return;
  }

  await db
    .update(schema.users)
    .set({ disabled, updatedAt: new Date() })
    .where(eq(schema.users.id, targetId));
  logger.info({ adminId: admin.id, targetId, disabled }, "admin: toggled user disabled");
  await setFlash(disabled ? "Account locked" : "Account unlocked");
  revalidatePath("/admin");
}

export async function deleteUserAction(formData: FormData): Promise<void> {
  const { user: admin } = await requireAdmin();
  const targetId = String(formData.get("userId") ?? "");
  if (!targetId) return;

  const target = await db.query.users.findFirst({
    where: eq(schema.users.id, targetId),
  });
  if (!target) return;
  if (target.id === admin.id) {
    await setFlash("Can't delete your own account from /admin", "warn");
    revalidatePath("/admin");
    return;
  }
  if (isOwnerEmail(target.email)) {
    await setFlash("Can't delete the owner", "error");
    revalidatePath("/admin");
    return;
  }

  await db.delete(schema.users).where(eq(schema.users.id, targetId));
  logger.warn({ adminId: admin.id, targetId, email: target.email }, "admin: deleted user");
  await setFlash("Account deleted");
  revalidatePath("/admin");
}

export async function promoteToAdminAction(formData: FormData): Promise<void> {
  const { user: admin } = await requireAdmin();
  const targetId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "user") === "admin" ? "admin" : "user";
  if (!targetId) return;

  const target = await db.query.users.findFirst({
    where: eq(schema.users.id, targetId),
  });
  if (!target) return;
  if (target.id === admin.id && role === "user") {
    await setFlash("Can't demote yourself", "warn");
    revalidatePath("/admin");
    return;
  }
  if (isOwnerEmail(target.email) && role === "user") {
    await setFlash("Can't demote the owner", "error");
    revalidatePath("/admin");
    return;
  }

  await db
    .update(schema.users)
    .set({ role, updatedAt: new Date() })
    .where(eq(schema.users.id, targetId));
  logger.info({ adminId: admin.id, targetId, role }, "admin: role changed");
  await setFlash(`Role set to ${role}`);
  revalidatePath("/admin");
}
