import { describe, expect, it } from "vitest";
import { decideUnitAccess } from "./unit-access";

const OWNER = "owner-1";
const OTHER = "user-2";

describe("decideUnitAccess", () => {
  it("owner gets the owner role and passes any requirement", () => {
    expect(decideUnitAccess({ userId: OWNER, ownerUserId: OWNER })).toEqual({
      allowed: true,
      role: "owner",
    });
    expect(
      decideUnitAccess({ userId: OWNER, ownerUserId: OWNER, requiredRoles: ["mft"] }),
    ).toEqual({ allowed: true, role: "owner" });
  });

  it("global admin is treated as owner", () => {
    expect(
      decideUnitAccess({ userId: OTHER, ownerUserId: OWNER, isGlobalAdmin: true }),
    ).toEqual({ allowed: true, role: "owner" });
  });

  it("a non-member of the unit is denied", () => {
    expect(
      decideUnitAccess({ userId: OTHER, ownerUserId: OWNER, membershipRole: null }),
    ).toEqual({ allowed: false, role: null });
  });

  it("an mft member passes an mft requirement; a plain member does not", () => {
    expect(
      decideUnitAccess({
        userId: OTHER,
        ownerUserId: OWNER,
        membershipRole: "mft",
        requiredRoles: ["mft"],
      }),
    ).toEqual({ allowed: true, role: "mft" });

    expect(
      decideUnitAccess({
        userId: OTHER,
        ownerUserId: OWNER,
        membershipRole: "member",
        requiredRoles: ["mft"],
      }),
    ).toEqual({ allowed: false, role: "member" });
  });

  it("a plain member passes when membership alone is required (no roles)", () => {
    expect(
      decideUnitAccess({ userId: OTHER, ownerUserId: OWNER, membershipRole: "member" }),
    ).toEqual({ allowed: true, role: "member" });
  });

  it("owner id check is not satisfied by a different user without membership", () => {
    const d = decideUnitAccess({
      userId: OTHER,
      ownerUserId: OWNER,
      requiredRoles: ["owner"],
    });
    expect(d.allowed).toBe(false);
  });
});
