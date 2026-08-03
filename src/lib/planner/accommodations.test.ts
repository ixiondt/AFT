import { describe, expect, it } from "vitest";
import { mmssToSec } from "@/lib/scoring";
import { generatePlan } from "./index";
import { applyAccommodations } from "./accommodations";
import type { PlanInput, ProfileAccommodation } from "./types";

const BASE: PlanInput = {
  age: 37,
  sex: "MC",
  bodyweightLb: 245,
  daysPerWeek: 6,
  durationWeeks: 13,
  equipment: ["barbell", "rack", "dumbbells", "kettlebell", "pullup_bar", "track"],
  injuries: [],
  preferences: { calisthenicsPreferred: false, activeRecovery: true },
  current: {
    MDL: 300,
    HRP: 40,
    SDC: mmssToSec("1:51"),
    PLK: mmssToSec("2:07"),
    "2MR": mmssToSec("17:37"),
  },
  goal: {
    MDL: 350,
    HRP: 50,
    SDC: mmssToSec("1:51"),
    PLK: mmssToSec("3:20"),
    "2MR": mmssToSec("15:00"),
  },
  testDate: "2026-09-05",
};

const NOW = new Date("2026-06-06T12:00:00Z");

const withProfile = (profile: ProfileAccommodation): PlanInput => ({ ...BASE, profile });

describe("applyAccommodations — no-op behavior", () => {
  it("returns the same plan object when no profile is supplied", () => {
    const plan = generatePlan(BASE, NOW);
    expect(applyAccommodations(plan)).toBe(plan);
    expect(plan.accommodations).toBeUndefined();
  });

  it("is a no-op for an empty profile", () => {
    const plan = generatePlan(BASE, NOW);
    const empty: ProfileAccommodation = {
      restrictions: [],
      exemptEvents: [],
      alternateAerobic: "none",
    };
    expect(applyAccommodations(plan, empty)).toBe(plan);
  });

  it("un-profiled plan is byte-identical to the same plan without a profile field", () => {
    const a = generatePlan(BASE, NOW);
    const b = generatePlan({ ...BASE, profile: undefined }, NOW);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("applyAccommodations — alternate cardio", () => {
  it("replaces run sessions with the chosen modality (row)", () => {
    const plan = generatePlan(withProfile({
      restrictions: [],
      exemptEvents: [],
      alternateAerobic: "row",
    }), NOW);

    const runDays = plan.weeks
      .flatMap((w) => w.days)
      .filter((d) => ["intervals", "tempo", "long"].includes(d.session.sessionType));

    expect(runDays.length).toBeGreaterThan(0);
    for (const d of runDays) {
      const text = JSON.stringify(d.session).toLowerCase();
      expect(text).toContain("row erg");
      // no leftover running pace target text
      expect(d.session.title.toLowerCase()).not.toMatch(/\bmi\b/);
    }
    expect(plan.accommodations?.some((s) => /row erg/.test(s))).toBe(true);
  });

  it("no_run with no explicit modality defaults to a low-impact bike substitute", () => {
    const plan = generatePlan(withProfile({
      restrictions: ["no_run"],
      exemptEvents: [],
      alternateAerobic: "none",
    }), NOW);
    const anIntervalDay = plan.weeks[1]!.days.find((d) => d.session.sessionType === "intervals");
    expect(JSON.stringify(anIntervalDay!.session).toLowerCase()).toContain("stationary bike");
  });
});

describe("applyAccommodations — lift cap", () => {
  it("clamps MDL ladder sets and session loads to the lift limit", () => {
    const cap = 135;
    const plan = generatePlan(withProfile({
      restrictions: ["lift_limit"],
      exemptEvents: [],
      alternateAerobic: "none",
      liftLimitLb: cap,
    }), NOW);

    for (const week of plan.mdlLadder) {
      for (const set of week.sets) expect(set.weightLb).toBeLessThanOrEqual(cap);
      if (week.topSingleLb !== undefined) expect(week.topSingleLb).toBeLessThanOrEqual(cap);
    }
    for (const w of plan.weeks) {
      for (const d of w.days) {
        for (const row of d.session.main) {
          if (typeof row.weightLb === "number") {
            expect(row.weightLb).toBeLessThanOrEqual(cap);
          }
        }
      }
    }
    expect(plan.accommodations?.some((s) => s.includes(`${cap} lb`))).toBe(true);
  });

  it("notes a lift_limit restriction with no weight rather than silently ignoring", () => {
    const plan = generatePlan(withProfile({
      restrictions: ["lift_limit"],
      exemptEvents: [],
      alternateAerobic: "none",
    }), NOW);
    expect(plan.accommodations?.some((s) => /no weight given/i.test(s))).toBe(true);
  });
});

describe("applyAccommodations — impact swaps", () => {
  it("rewrites impact/plyometric rows under a no_impact profile", () => {
    const plan = generatePlan(withProfile({
      restrictions: ["no_impact"],
      exemptEvents: [],
      alternateAerobic: "none",
    }), NOW);
    // The SDC proxy / sprint rows should be flagged as low-impact subs somewhere.
    const allNames = plan.weeks
      .flatMap((w) => w.days)
      .flatMap((d) => d.session.main.map((m) => m.name.toLowerCase()))
      .join(" | ");
    if (/sprint|jump|plyo|box|bound|hop|explosive/.test(allNames)) {
      // if any impact movement survived, it must be a labeled substitute
      expect(allNames).toContain("low-impact substitute");
    }
  });
});

describe("applyAccommodations — exempt events", () => {
  it("drops an exempt event from gaps and checkpoints and empties its progression", () => {
    const plan = generatePlan(withProfile({
      restrictions: [],
      exemptEvents: ["MDL"],
      alternateAerobic: "none",
    }), NOW);

    expect(plan.gaps.some((g) => g.event === "MDL")).toBe(false);
    expect(plan.mdlLadder.length).toBe(0);
    for (const c of plan.checkpoints) expect(c.events).not.toContain("MDL");

    // No deadlift rows survive in any session.
    const deadliftRows = plan.weeks
      .flatMap((w) => w.days)
      .flatMap((d) => d.session.main)
      .filter((row) => /deadlift/i.test(row.name));
    expect(deadliftRows.length).toBe(0);
    expect(plan.accommodations?.some((s) => /MDL exempt/.test(s))).toBe(true);
  });

  it("handles exempting an event with no strength rows (2MR) at the top level", () => {
    const plan = generatePlan(withProfile({
      restrictions: [],
      exemptEvents: ["2MR"],
      alternateAerobic: "none",
    }), NOW);
    expect(plan.gaps.some((g) => g.event === "2MR")).toBe(false);
    for (const c of plan.checkpoints) expect(c.events).not.toContain("2MR");
  });

  it("never leaves a session with an empty main array", () => {
    const plan = generatePlan(withProfile({
      restrictions: [],
      exemptEvents: ["MDL", "HRP", "SDC", "PLK"],
      alternateAerobic: "none",
    }), NOW);
    for (const w of plan.weeks) {
      for (const d of w.days) {
        expect(d.session.main.length).toBeGreaterThan(0);
      }
    }
  });
});
