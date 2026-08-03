import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { MemberInput } from "./schemas";

/** URL-safe single-use claim token. crypto-random (never Math.random). */
export function newClaimToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function createUnit(args: {
  ownerUserId: string;
  name: string;
}): Promise<{ id: string }> {
  const [row] = await db
    .insert(schema.units)
    .values({ name: args.name, ownerUserId: args.ownerUserId })
    .returning({ id: schema.units.id });
  if (!row) throw new Error("Failed to create unit");
  return row;
}

/** Split a member form into the roster-row columns (baseline + identity). */
function memberRowFields(input: MemberInput) {
  return {
    displayName: input.displayName,
    role: input.role,
    age: input.age ?? null,
    sex: input.sex ?? null,
    bodyweightLb: input.bodyweightLb ?? null,
    heightIn: input.heightIn ?? null,
    mdlLb: input.mdlLb ?? null,
    hrpReps: input.hrpReps ?? null,
    sdcSec: input.sdcSec ?? null,
    plkSec: input.plkSec ?? null,
    twoMileSec: input.twoMileSec ?? null,
  };
}

/**
 * Replace a member's active medical profile from the form: deactivate any prior
 * active profile for this member, then insert the new one if declared.
 */
async function syncMemberMedicalProfile(memberId: string, input: MemberInput): Promise<void> {
  await db
    .update(schema.medicalProfiles)
    .set({ active: false, updatedAt: new Date() })
    .where(
      and(
        eq(schema.medicalProfiles.unitMemberId, memberId),
        eq(schema.medicalProfiles.active, true),
      ),
    );
  if (input.hasMedicalProfile && input.profileType) {
    await db.insert(schema.medicalProfiles).values({
      unitMemberId: memberId,
      profileType: input.profileType,
      startDate: input.profileStart ? new Date(input.profileStart) : null,
      expiresAt: input.profileExpires ? new Date(input.profileExpires) : null,
      exemptEvents: input.exemptEvents as string[],
      alternateAerobic: input.alternateAerobic,
      restrictions: input.restrictions as string[],
      liftLimitLb: input.liftLimitLb ?? null,
      notes: input.profileNotes ?? null,
      active: true,
    });
  }
}

export async function addMember(args: {
  unitId: string;
  input: MemberInput;
}): Promise<{ id: string }> {
  const [row] = await db
    .insert(schema.unitMembers)
    .values({
      unitId: args.unitId,
      claimToken: newClaimToken(),
      ...memberRowFields(args.input),
    })
    .returning({ id: schema.unitMembers.id });
  if (!row) throw new Error("Failed to add member");
  await syncMemberMedicalProfile(row.id, args.input);
  return row;
}

/**
 * Update a member — scoped by BOTH unitId and memberId so a caller authorized
 * for one unit can't mutate another unit's member (IDOR guard). Returns whether
 * a row matched.
 */
export async function updateMember(args: {
  unitId: string;
  memberId: string;
  input: MemberInput;
}): Promise<boolean> {
  const updated = await db
    .update(schema.unitMembers)
    .set({ ...memberRowFields(args.input), updatedAt: new Date() })
    .where(
      and(
        eq(schema.unitMembers.id, args.memberId),
        eq(schema.unitMembers.unitId, args.unitId),
      ),
    )
    .returning({ id: schema.unitMembers.id });
  if (updated.length === 0) return false;
  await syncMemberMedicalProfile(args.memberId, args.input);
  return true;
}

export async function removeMember(args: {
  unitId: string;
  memberId: string;
}): Promise<void> {
  await db
    .delete(schema.unitMembers)
    .where(
      and(
        eq(schema.unitMembers.id, args.memberId),
        eq(schema.unitMembers.unitId, args.unitId),
      ),
    );
}

export type RosterMember = typeof schema.unitMembers.$inferSelect & {
  medicalProfile: typeof schema.medicalProfiles.$inferSelect | null;
};

/** Load a unit's roster with each member's active medical profile attached. */
export async function getUnitRoster(unitId: string): Promise<RosterMember[]> {
  const members = await db.query.unitMembers.findMany({
    where: eq(schema.unitMembers.unitId, unitId),
    orderBy: [asc(schema.unitMembers.displayName)],
  });
  if (members.length === 0) return [];

  const memberIds = members.map((m) => m.id);
  const profiles = await db.query.medicalProfiles.findMany({
    where: and(
      eq(schema.medicalProfiles.active, true),
      inArray(schema.medicalProfiles.unitMemberId, memberIds),
    ),
  });
  const byMember = new Map(
    profiles
      .filter((p) => p.unitMemberId !== null)
      .map((p) => [p.unitMemberId as string, p]),
  );

  return members.map((m) => ({ ...m, medicalProfile: byMember.get(m.id) ?? null }));
}

/**
 * Claim a roster entry with a token, linking it to a user account. Single-use:
 * clears the token and stamps claimedAt. Returns the outcome for the caller to
 * surface. Fails closed on a bad/used token or a duplicate membership.
 */
export async function claimMemberByToken(args: {
  token: string;
  userId: string;
}): Promise<{ ok: true; unitId: string } | { ok: false; reason: string }> {
  const member = await db.query.unitMembers.findFirst({
    where: eq(schema.unitMembers.claimToken, args.token),
  });
  if (!member) return { ok: false, reason: "This claim link is invalid or already used." };
  if (member.userId) return { ok: false, reason: "This roster entry is already claimed." };

  // A user can link to a unit at most once (mirrors the DB unique constraint).
  const existing = await db.query.unitMembers.findFirst({
    where: and(
      eq(schema.unitMembers.unitId, member.unitId),
      eq(schema.unitMembers.userId, args.userId),
    ),
  });
  if (existing) return { ok: false, reason: "You're already on this unit's roster." };

  try {
    const updated = await db
      .update(schema.unitMembers)
      .set({ userId: args.userId, claimToken: null, claimedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(schema.unitMembers.id, member.id),
          eq(schema.unitMembers.claimToken, args.token), // re-check: lose a concurrent race safely
        ),
      )
      .returning({ id: schema.unitMembers.id });
    if (updated.length === 0) {
      return { ok: false, reason: "This claim link is invalid or already used." };
    }
  } catch {
    // Unique (unitId, userId) violation on a concurrent double-claim, etc.
    return { ok: false, reason: "You're already on this unit's roster." };
  }

  return { ok: true, unitId: member.unitId };
}
