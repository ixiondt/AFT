import { describe, expect, it } from "vitest";
import { mmssToSec, secToMmss } from "@/lib/scoring";
import { generatePlan } from "./index";
import { vdotFor2MR } from "./pace";
import type { PlanInput } from "./types";

const SORIANO: PlanInput = {
  age: 37,
  sex: "MC",
  bodyweightLb: 245,
  daysPerWeek: 6,
  durationWeeks: 13,
  equipment: ["barbell", "rack", "dumbbells", "kettlebell", "pullup_bar", "track"],
  injuries: [],
  preferences: { calisthenicsPreferred: true, activeRecovery: true },
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

describe("generatePlan — MAJ Soriano 13-week case", () => {
  const plan = generatePlan(SORIANO, new Date("2026-06-06T12:00:00Z"));

  it("scores the bracket and current/goal totals", () => {
    expect(plan.bracket).toBe("37-41");
    expect(plan.currentTotal).toBe(422);
    expect(plan.goalTotal).toBeGreaterThanOrEqual(479);
  });

  it("ranks gaps with PLK biggest, SDC last (already met)", () => {
    expect(plan.gaps[0]?.event).toBe("PLK");
    expect(plan.gaps[plan.gaps.length - 1]?.event).toBe("SDC");
    expect(plan.gaps[plan.gaps.length - 1]?.gap).toBe(0);
  });

  it("lays out 4 blocks summing to 13 weeks with a 1-week test", () => {
    const total = plan.blocks.reduce((acc, b) => acc + b.weeks, 0);
    expect(total).toBe(13);
    expect(plan.blocks.map((b) => b.name)).toEqual(["Base", "Build", "Peak", "Test"]);
    expect(plan.blocks[plan.blocks.length - 1]?.weeks).toBe(1);
  });

  it("derives VDOT ~37 from a 17:37 2-mile", () => {
    const vdot = vdotFor2MR(mmssToSec("17:37"));
    expect(vdot).toBeGreaterThanOrEqual(36);
    expect(vdot).toBeLessThanOrEqual(38);
  });

  it("paces are in the right neighborhood (Easy ~9:30-10:00, Tempo ~7:40-8:10/mi)", () => {
    expect(plan.paces.easyPerMileSec).toBeGreaterThanOrEqual(mmssToSec("9:20"));
    expect(plan.paces.easyPerMileSec).toBeLessThanOrEqual(mmssToSec("10:10"));
    expect(plan.paces.tempoPerMileSec).toBeGreaterThanOrEqual(mmssToSec("7:30"));
    expect(plan.paces.tempoPerMileSec).toBeLessThanOrEqual(mmssToSec("8:30"));
  });

  it("MDL ladder's last week peaks at the goal weight", () => {
    const lastWeek = plan.mdlLadder[plan.mdlLadder.length - 1]!;
    const heaviestSet = lastWeek.sets.reduce((max, s) => Math.max(max, s.weightLb), 0);
    expect(heaviestSet).toBe(350);
  });

  it("plank progression ends at goal hold time (3:20)", () => {
    const lastWeek = plan.plankProgression[plan.plankProgression.length - 1]!;
    expect(lastWeek.maxAttempt).toBe(mmssToSec("3:20"));
  });

  it("HRP progression's test week targets goal reps (50)", () => {
    const lastWeek = plan.hrpProgression[plan.hrpProgression.length - 1]!;
    expect(lastWeek.amrapTarget).toBe(50);
  });

  it("each week has 7 day entries", () => {
    for (const w of plan.weeks) {
      expect(w.days.length).toBe(7);
    }
  });

  it("3 checkpoints, last one is the full AFT on the final week", () => {
    expect(plan.checkpoints.length).toBe(3);
    const last = plan.checkpoints[plan.checkpoints.length - 1]!;
    expect(last.weekIndex).toBe(12);
    expect(last.events).toEqual(["MDL", "HRP", "SDC", "PLK", "2MR"]);
  });

  it("active recovery is honored — recovery day, not 'rest'", () => {
    const recoveryDays = plan.weeks[0]!.days.filter(
      (d) => d.session.sessionType === "recovery",
    );
    expect(recoveryDays.length).toBeGreaterThan(0);
    expect(recoveryDays[0]?.session.title.toLowerCase()).toContain("recovery");
  });

  it("calisthenics-preferred picks pull-ups / dips in strength sessions", () => {
    const strengthB = plan.weeks[0]!.days.find(
      (d) => d.session.sessionType === "strength_b",
    );
    expect(strengthB).toBeDefined();
    const exerciseNames = strengthB!.session.main.map((m) => m.name.toLowerCase()).join(" ");
    expect(exerciseNames).toMatch(/dip|pistol|split squat|bird-dog/);
  });
});

describe("generatePlan — fewer-days variant", () => {
  it("4-day plan only schedules 4 training sessions", () => {
    const plan = generatePlan(
      { ...SORIANO, daysPerWeek: 4 },
      new Date("2026-06-06T12:00:00Z"),
    );
    const trainingDays = plan.weeks[2]!.days.filter(
      (d) =>
        d.session.sessionType !== "rest" && d.session.sessionType !== "recovery",
    );
    expect(trainingDays.length).toBeLessThanOrEqual(4);
  });
});

describe("generatePlan — SDC equipment fallback", () => {
  it("falls back to proxy when sled/KB missing", () => {
    const plan = generatePlan(
      {
        ...SORIANO,
        equipment: ["barbell", "rack", "dumbbells", "track"], // no sled/kettlebell
      },
      new Date("2026-06-06T12:00:00Z"),
    );
    const aftSkillsDay = plan.weeks[1]!.days.find(
      (d) => d.session.sessionType === "aft_skills",
    );
    expect(aftSkillsDay).toBeDefined();
    const titles = aftSkillsDay!.session.main.map((m) => m.name.toLowerCase()).join(" ");
    expect(titles).toContain("proxy");
  });
});
