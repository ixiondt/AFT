import { cache } from "react";
import { and, desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getAuthAndUser } from "./admin";
import { decideUnitAccess, type UnitRole } from "./unit-access";

export { decideUnitAccess, type UnitRole };

/**
 * Resolve the caller's context for a unit: the authed user, the unit row, their
 * membership (if any), and their effective role. Returns null when unauthenticated
 * or the unit doesn't exist. Per-request memoized.
 *
 * NOTE: a non-member of an existing unit still gets a context with `role: null`;
 * callers gate on the role. `requireUnitAccess` collapses not-found and forbidden
 * into the same redirect so units can't be enumerated.
 */
export const getUnitContext = cache(async (unitId: string) => {
  const auth = await getAuthAndUser();
  if (!auth || auth.disabled) return null;

  const unit = await db.query.units.findFirst({
    where: eq(schema.units.id, unitId),
  });
  if (!unit) return null;

  const membership = await db.query.unitMembers.findFirst({
    where: and(
      eq(schema.unitMembers.unitId, unitId),
      eq(schema.unitMembers.userId, auth.user.id),
    ),
  });

  const { role } = decideUnitAccess({
    userId: auth.user.id,
    ownerUserId: unit.ownerUserId,
    membershipRole: membership?.role ?? null,
    isGlobalAdmin: auth.user.role === "admin",
  });

  return {
    userId: auth.user.id,
    isGlobalAdmin: auth.user.role === "admin",
    unit,
    membership: membership ?? null,
    role,
  };
});

/**
 * Gate a server component / action on unit access. Redirects to `/units`
 * (generic — same for not-found and forbidden) when the caller may not act.
 * Returns the resolved context on success.
 */
export async function requireUnitAccess(
  unitId: string,
  requiredRoles?: readonly UnitRole[],
) {
  const ctx = await getUnitContext(unitId);
  if (!ctx) redirect("/units");

  const decision = decideUnitAccess({
    userId: ctx.userId,
    ownerUserId: ctx.unit.ownerUserId,
    membershipRole: ctx.membership?.role ?? null,
    isGlobalAdmin: ctx.isGlobalAdmin,
    requiredRoles,
  });
  if (!decision.allowed) redirect("/units");

  return { ...ctx, role: decision.role };
}

export async function isUnitOwner(userId: string, unitId: string): Promise<boolean> {
  const unit = await db.query.units.findFirst({
    where: eq(schema.units.id, unitId),
    columns: { ownerUserId: true },
  });
  return unit?.ownerUserId === userId;
}

/** Units the user owns plus units they're a (claimed) member of — deduped. */
export async function listUnitsForUser(userId: string) {
  const owned = await db.query.units.findMany({
    where: eq(schema.units.ownerUserId, userId),
    orderBy: [desc(schema.units.createdAt)],
  });

  const memberRows = await db.query.unitMembers.findMany({
    where: eq(schema.unitMembers.userId, userId),
    columns: { unitId: true },
  });
  const ownedIds = new Set(owned.map((u) => u.id));
  const memberUnitIds = [
    ...new Set(memberRows.map((m) => m.unitId).filter((id) => !ownedIds.has(id))),
  ];
  const member = memberUnitIds.length
    ? await db.query.units.findMany({
        where: inArray(schema.units.id, memberUnitIds),
        orderBy: [desc(schema.units.createdAt)],
      })
    : [];

  return { owned, member };
}
