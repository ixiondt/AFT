import { describe, expect, it } from "vitest";
import { mmssToSec } from "@/lib/scoring";
import { generateAtPlan } from "./index";
import type { AtMemberInput, AtPlanInput } from "./types";

function member(over: Partial<AtMemberInput> & { id: string; displayName: string }): AtMemberInput {
  return {
    age: 30,
    sex: "MC",
    baseline: null,
    twoMileSec: null,
    mdlLb: null,
    ...over,
  };
}

const NOW = new Date("2026-06-06T12:00:00Z");

function planWith(members: AtMemberInput[], over: Partial<AtPlanInput> = {}) {
  return generateAtPlan(
    {
      unitName: "B Co",
      startDateISO: "2026-07-06", // a Monday
      days: 14,
      members,
      ...over,
    },
    NOW,
  );
}

describe("generateAtPlan — ability grouping", () => {
  it("buckets runners into A/B/C by 2-mile time", () => {
    const plan = planWith([
      member({ id: "fast", displayName: "A", twoMileSec: mmssToSec("13:00"), mdlLb: 300 }),
      member({ id: "mid", displayName: "B", twoMileSec: mmssToSec("16:00"), mdlLb: 250 }),
      member({ id: "dev", displayName: "C", twoMileSec: mmssToSec("19:00"), mdlLb: 200 }),
    ]);
    const byMember = new Map(plan.cards.map((c) => [c.memberId, c.abilityGroup]));
    expect(byMember.get("fast")).toBe("A");
    expect(byMember.get("mid")).toBe("B");
    expect(byMember.get("dev")).toBe("C");
  });

  it("routes a profiled (no-run) soldier into the ALT group with a modality", () => {
    const plan = planWith([
      member({
        id: "prof",
        displayName: "P",
        twoMileSec: mmssToSec("15:00"),
        profile: { restrictions: ["no_run"], exemptEvents: [], alternateAerobic: "row" },
      }),
    ]);
    expect(plan.cards[0]!.abilityGroup).toBe("ALT");
    const alt = plan.groups.find((g) => g.key === "ALT");
    expect(alt?.modality).toBe("row");
    expect(plan.cards[0]!.runPrescription.toLowerCase()).toContain("row");
  });

  it("flags soldiers with no baseline run as UNASSESSED and warns", () => {
    const plan = planWith([
      member({ id: "new", displayName: "N", twoMileSec: null }),
    ]);
    expect(plan.cards[0]!.abilityGroup).toBe("UNASSESSED");
    expect(plan.warnings.some((w) => /baseline run/i.test(w))).toBe(true);
  });

  it("paces a run group to its slowest member (nobody dropped)", () => {
    const plan = planWith([
      member({ id: "b1", displayName: "b1", twoMileSec: mmssToSec("14:10") }),
      member({ id: "b2", displayName: "b2", twoMileSec: mmssToSec("16:50") }),
    ]);
    const b = plan.groups.find((g) => g.key === "B");
    expect(b?.prescribedPacePerMileSec).toBeDefined();
    // slowest (16:50) easy pace is slower (larger sec) than the faster runner's
    const slowOnly = planWith([member({ id: "x", displayName: "x", twoMileSec: mmssToSec("16:50") })]);
    const bSlow = slowOnly.groups.find((g) => g.key === "B");
    expect(b!.prescribedPacePerMileSec).toBe(bSlow!.prescribedPacePerMileSec);
  });
});

describe("generateAtPlan — schedule", () => {
  it("covers every AT day and rests on Sundays", () => {
    const plan = planWith([member({ id: "a", displayName: "a", twoMileSec: mmssToSec("15:00") })]);
    expect(plan.schedule.length).toBe(14);
    // 2026-07-06 is a Monday; day index 6 and 13 are Sundays → rest.
    expect(plan.schedule[6]!.rest).toBe(true);
    expect(plan.schedule[13]!.rest).toBe(true);
    expect(plan.schedule[0]!.rest).toBe(false);
    for (const d of plan.schedule) {
      if (!d.rest) {
        expect(d.preparation.length).toBeGreaterThan(0);
        expect(d.activities.length).toBeGreaterThan(0);
      }
    }
  });

  it("rejects an out-of-range AT length", () => {
    expect(() => planWith([], { days: 0 })).toThrow();
    expect(() => planWith([], { days: 30 })).toThrow();
  });
});

describe("generateAtPlan — soldier cards", () => {
  it("caps deadlift load at the profile's lift limit", () => {
    const plan = planWith([
      member({
        id: "cap",
        displayName: "C",
        twoMileSec: mmssToSec("15:00"),
        mdlLb: 400, // 0.6*400 = 240 working, capped to 135
        profile: {
          restrictions: ["lift_limit"],
          exemptEvents: [],
          alternateAerobic: "none",
          liftLimitLb: 135,
        },
      }),
    ]);
    const card = plan.cards[0]!;
    expect(card.strengthPrescription).toMatch(/135 lb/);
    expect(card.strengthPrescription.toLowerCase()).toContain("capped");
    expect(card.accommodations.some((a) => /135 lb/.test(a))).toBe(true);
  });

  it("skips deadlift work when MDL is exempt", () => {
    const plan = planWith([
      member({
        id: "ex",
        displayName: "E",
        twoMileSec: mmssToSec("15:00"),
        mdlLb: 300,
        profile: { restrictions: [], exemptEvents: ["MDL"], alternateAerobic: "none" },
      }),
    ]);
    expect(plan.cards[0]!.strengthPrescription.toLowerCase()).toContain("exempt");
  });

  it("empty roster still produces a valid plan with a warning", () => {
    const plan = planWith([]);
    expect(plan.cards.length).toBe(0);
    expect(plan.schedule.length).toBe(14);
    expect(plan.warnings.length).toBeGreaterThan(0);
  });
});
