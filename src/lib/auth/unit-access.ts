/**
 * Pure unit-access decision logic. Deliberately dependency-free (no DB, no
 * next-auth) so it can be unit-tested in isolation and imported anywhere.
 */

export type UnitRole = "owner" | "mft" | "member";

/**
 * Decide a caller's access to a unit from ownership + membership + a role gate.
 * Owner (and global admin, surfaced as owner) satisfies any role requirement.
 */
export function decideUnitAccess(args: {
  userId: string;
  ownerUserId: string;
  membershipRole?: "mft" | "member" | null;
  isGlobalAdmin?: boolean;
  requiredRoles?: readonly UnitRole[];
}): { allowed: boolean; role: UnitRole | null } {
  const { userId, ownerUserId, membershipRole, isGlobalAdmin, requiredRoles } = args;

  let role: UnitRole | null = null;
  if (userId === ownerUserId || isGlobalAdmin) role = "owner";
  else if (membershipRole === "mft") role = "mft";
  else if (membershipRole === "member") role = "member";

  if (role === null) return { allowed: false, role: null };
  if (!requiredRoles || requiredRoles.length === 0) return { allowed: true, role };

  // Owner overrides any requirement; otherwise the role must be allow-listed.
  const allowed = role === "owner" || requiredRoles.includes(role);
  return { allowed, role };
}
