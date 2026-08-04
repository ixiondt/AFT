import { describe, expect, it } from "vitest";
import { mmssToSec } from "./index";
import { scoreAftProfiled } from "./profiled";
import type { RawScores } from "./types";

// A 37-yr-old MC set that scores comfortably above 60 on each event.
const RAW: RawScores = {
  MDL: 340,
  HRP: 55,
  SDC: mmssToSec("1:33"),
  PLK: mmssToSec("3:40"),
  "2MR": mmssToSec("13:30"),
};

const base = { age: 37, sex: "MC" as const, raw: RAW };

describe("scoreAftProfiled — exempt events", () => {
  it("drops an exempt event from the total and event map", () => {
    const r = scoreAftProfiled({
      ...base,
      profile: { profileType: "permanent", exemptEvents: ["HRP"], alternateAerobic: "none" },
    });
    expect(r.events.HRP).toBeUndefined();
    expect(r.exemptEvents).toContain("HRP");
    expect(r.scoredEventCount).toBe(4);
    // total is the sum of the 4 scored events (not out of 500)
    const manual = (r.events.MDL ?? 0) + (r.events.SDC ?? 0) + (r.events.PLK ?? 0) + (r.events["2MR"] ?? 0);
    expect(r.total).toBe(manual);
    expect(r.pass).toBe(true);
  });
});

describe("scoreAftProfiled — alternate aerobic (Go/No-Go)", () => {
  it("replaces the 2-mile with the alternate; Go = 60", () => {
    const r = scoreAftProfiled({
      ...base,
      profile: {
        profileType: "permanent",
        exemptEvents: [],
        alternateAerobic: "row",
        alternateResult: "go",
      },
    });
    expect(r.events["2MR"]).toBeUndefined();
    expect(r.alternate).toEqual({ modality: "row", result: "go", points: 60 });
    expect(r.scoredEventCount).toBe(5); // MDL/HRP/SDC/PLK + alternate
    expect(r.pass).toBe(true);
  });

  it("No-Go on the alternate = 0 pts and a fail", () => {
    const r = scoreAftProfiled({
      ...base,
      profile: {
        profileType: "permanent",
        exemptEvents: [],
        alternateAerobic: "bike",
        alternateResult: "no_go",
      },
    });
    expect(r.alternate?.points).toBe(0);
    expect(r.pass).toBe(false);
  });

  it("missing alternate result defaults to No-Go (fail-closed)", () => {
    const r = scoreAftProfiled({
      ...base,
      profile: { profileType: "permanent", exemptEvents: [], alternateAerobic: "swim" },
    });
    expect(r.alternate?.result).toBe("no_go");
    expect(r.pass).toBe(false);
  });

  it("exempt HRP + row Go matches the doctrinal worked example (4 scored + alt)", () => {
    const r = scoreAftProfiled({
      ...base,
      profile: {
        profileType: "permanent",
        exemptEvents: ["HRP"],
        alternateAerobic: "row",
        alternateResult: "go",
      },
    });
    expect(r.events.HRP).toBeUndefined();
    expect(r.events["2MR"]).toBeUndefined();
    expect(r.scoredEventCount).toBe(4); // MDL, SDC, PLK + row
    expect(r.total).toBe((r.events.MDL ?? 0) + (r.events.SDC ?? 0) + (r.events.PLK ?? 0) + 60);
  });
});

describe("scoreAftProfiled — temporary profile", () => {
  it("is diagnostic, never a record", () => {
    const r = scoreAftProfiled({
      ...base,
      profile: { profileType: "temporary", exemptEvents: ["SDC"], alternateAerobic: "none" },
    });
    expect(r.isRecord).toBe(false);
    expect(r.status).toBe("diagnostic");
  });

  it("permanent profile is a record", () => {
    const r = scoreAftProfiled({
      ...base,
      profile: { profileType: "permanent", exemptEvents: [], alternateAerobic: "none" },
    });
    expect(r.isRecord).toBe(true);
    expect(r.status).toBe("record");
    expect(r.scoredEventCount).toBe(5);
  });
});
