"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function setPinAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const pin = String(formData.get("pin") ?? "");
  if (!/^\d{4,6}$/.test(pin)) {
    redirect("/dashboard?pin_error=" + encodeURIComponent("PIN must be 4–6 digits"));
  }

  const pinHash = await bcrypt.hash(pin, 12);
  await db
    .update(schema.users)
    .set({ pinHash, updatedAt: new Date() })
    .where(eq(schema.users.id, session.user.id));

  logger.info({ userId: session.user.id }, "pin set");
  revalidatePath("/dashboard");
}

export async function clearPinAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  await db
    .update(schema.users)
    .set({ pinHash: null, updatedAt: new Date() })
    .where(eq(schema.users.id, session.user.id));

  logger.info({ userId: session.user.id }, "pin cleared");
  revalidatePath("/dashboard");
}
