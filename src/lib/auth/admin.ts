import { cache } from "react";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "./config";
import { db, schema } from "@/lib/db";

const OWNER_EMAIL = "julio.soriano30@gmail.com";

/**
 * Returns the authed session + DB-fresh role/disabled. Auto-promotes the owner
 * email to admin the first time we see them — convenient for solo-owner deploys.
 *
 * Wrapped in React's `cache()` so layout + page + components in the same
 * request share one auth round-trip. Per-request scope only.
 */
export const getAuthAndUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.user.id),
  });
  if (!user) return null;
  if (user.disabled) return { session, user, disabled: true as const };

  // Owner auto-promote
  if (user.role !== "admin" && user.email === OWNER_EMAIL) {
    await db
      .update(schema.users)
      .set({ role: "admin", updatedAt: new Date() })
      .where(eq(schema.users.id, user.id));
    user.role = "admin";
  }

  // Track last seen (best-effort; failures don't block the request)
  void db
    .update(schema.users)
    .set({ lastSeenAt: new Date() })
    .where(eq(schema.users.id, user.id))
    .catch(() => {});

  return { session, user, disabled: false as const };
});

/** Require an admin role; redirect non-admins to /dashboard. */
export async function requireAdmin() {
  const auth = await getAuthAndUser();
  if (!auth) redirect("/signin");
  if (auth.disabled) redirect("/signin?error=disabled");
  if (auth.user.role !== "admin") redirect("/dashboard");
  return auth;
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.toLowerCase() === OWNER_EMAIL);
}
