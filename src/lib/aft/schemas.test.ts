import { describe, expect, it } from "vitest";
import { PROFILE_FORM_SCHEMA } from "./schemas";
import { MEMBER_SCHEMA } from "@/lib/units/schemas";

/**
 * Regression: FormData.get() returns `null` for fields not in the DOM (e.g. the
 * collapsed medical-profile section). Optional fields must accept null, not
 * throw the ZodUnion "Invalid input".
 */
describe("PROFILE_FORM_SCHEMA — null optional fields", () => {
  const requiredValid = {
    age: "32",
    sex: "MC",
    bodyweightLb: "190",
    daysPerWeek: "5",
    durationWeeks: "13",
    testDate: "2026-09-05",
    currentMdlLb: "250",
    currentHrpReps: "35",
    currentSdc: "1:50",
    currentPlk: "2:30",
    current2MR: "17:30",
    goalMdlLb: "300",
    goalHrpReps: "45",
    goalSdc: "1:45",
    goalPlk: "3:00",
    goal2MR: "15:30",
  };

  it("parses with every optional/profile field null (no medical profile)", () => {
    const r = PROFILE_FORM_SCHEMA.safeParse({
      ...requiredValid,
      goalBodyweightLb: null,
      heightIn: null,
      hasMedicalProfile: null,
      profileType: null,
      profileStart: null,
      profileExpires: null,
      currentAlternateResult: null,
      liftLimitLb: null,
      profileNotes: null,
    });
    expect(r.success).toBe(true);
  });

  it("still validates a real bad value", () => {
    const r = PROFILE_FORM_SCHEMA.safeParse({ ...requiredValid, heightIn: "200" });
    expect(r.success).toBe(false);
  });
});

describe("MEMBER_SCHEMA — null optional fields", () => {
  it("parses a name-only member with all optional fields null", () => {
    const r = MEMBER_SCHEMA.safeParse({
      displayName: "SGT Doe",
      role: null,
      age: null,
      sex: null,
      bodyweightLb: null,
      heightIn: null,
      mdlLb: null,
      hrpReps: null,
      sdcSec: null,
      plkSec: null,
      twoMileSec: null,
      hasMedicalProfile: null,
      profileType: null,
      profileStart: null,
      profileExpires: null,
      alternateResult: null,
      liftLimitLb: null,
      profileNotes: null,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.displayName).toBe("SGT Doe");
      expect(r.data.role).toBe("member"); // default
      expect(r.data.age).toBeUndefined();
      expect(r.data.liftLimitLb).toBeUndefined(); // not a phantom 0
    }
  });

  it("rejects an empty name", () => {
    const r = MEMBER_SCHEMA.safeParse({ displayName: "   " });
    expect(r.success).toBe(false);
  });
});
