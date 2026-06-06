import { describe, expect, it } from "vitest";
import {
  ageToBracket,
  mmssToSec,
  pointGapByEvent,
  scoreAft,
  scoreEvent,
  secToMmss,
} from "./index";

describe("ageToBracket", () => {
  it("maps inclusive lower/upper bounds correctly", () => {
    expect(ageToBracket(17)).toBe("17-21");
    expect(ageToBracket(21)).toBe("17-21");
    expect(ageToBracket(22)).toBe("22-26");
    expect(ageToBracket(37)).toBe("37-41");
    expect(ageToBracket(41)).toBe("37-41");
    expect(ageToBracket(62)).toBe("62+");
    expect(ageToBracket(99)).toBe("62+");
  });

  it("rejects out-of-range or non-integer ages", () => {
    expect(() => ageToBracket(16)).toThrow();
    expect(() => ageToBracket(37.5)).toThrow();
  });
});

describe("mmssToSec / secToMmss", () => {
  it("round-trips canonical times", () => {
    for (const s of ["0:00", "1:51", "2:07", "17:37", "23:59"]) {
      expect(secToMmss(mmssToSec(s))).toBe(s);
    }
  });

  it("rejects bad input", () => {
    expect(() => mmssToSec("1:60")).toThrow();
    expect(() => mmssToSec("abc")).toThrow();
    expect(() => mmssToSec("1.5")).toThrow();
  });
});

describe("scoreEvent — 37-41 MC sanity checks", () => {
  it("MDL maxes at 350 lb for 37-41 male", () => {
    expect(scoreEvent("MDL", "37-41", "MC", 350)).toBe(100);
    expect(scoreEvent("MDL", "37-41", "MC", 360)).toBe(100); // over-max still caps at 100
  });

  it("PLK maxes at 3:20 for 37-41 male", () => {
    expect(scoreEvent("PLK", "37-41", "MC", mmssToSec("3:20"))).toBe(100);
  });

  it("returns 0 for performance below the lowest threshold", () => {
    expect(scoreEvent("MDL", "37-41", "MC", 10)).toBe(0);
    expect(scoreEvent("2MR", "37-41", "MC", mmssToSec("59:00"))).toBe(0);
  });
});

describe("scoreAft — MAJ Soriano known case", () => {
  it("totals 422 for his current scores (37 M, bracket 37-41, lane MC)", () => {
    const result = scoreAft({
      age: 37,
      sex: "MC",
      raw: {
        MDL: 300,
        HRP: 40,
        SDC: mmssToSec("1:51"),
        PLK: mmssToSec("2:07"),
        "2MR": mmssToSec("17:37"),
      },
    });
    expect(result.bracket).toBe("37-41");
    expect(result.events.MDL).toBe(91);
    expect(result.events.HRP).toBe(85);
    expect(result.events.SDC).toBe(90);
    expect(result.events.PLK).toBe(77);
    expect(result.events["2MR"]).toBe(79);
    expect(result.total).toBe(422);
    expect(result.pass).toBe(true);
    expect(result.failedEvents).toEqual([]);
  });

  it("flags failed events (< 60 pts) without affecting total", () => {
    const result = scoreAft({
      age: 37,
      sex: "MC",
      raw: {
        MDL: 350,
        HRP: 5, // way below 60
        SDC: mmssToSec("1:36"),
        PLK: mmssToSec("3:20"),
        "2MR": mmssToSec("13:42"),
      },
    });
    expect(result.pass).toBe(false);
    expect(result.failedEvents).toEqual(["HRP"]);
  });
});

describe("pointGapByEvent", () => {
  it("ranks largest positive gap first; already-met events sink to the bottom", () => {
    // Gaps: PLK 23, 2MR 13, HRP 10, MDL 9, SDC 0
    const current = { MDL: 91, HRP: 85, SDC: 90, PLK: 77, "2MR": 79 } as const;
    const goal = { MDL: 100, HRP: 95, SDC: 90, PLK: 100, "2MR": 92 } as const;
    const gaps = pointGapByEvent(current, goal);
    expect(gaps.map((g) => g.event)).toEqual(["PLK", "2MR", "HRP", "MDL", "SDC"]);
    expect(gaps[0]).toEqual({
      event: "PLK",
      currentPoints: 77,
      goalPoints: 100,
      gap: 23,
    });
    expect(gaps[4]).toEqual({
      event: "SDC",
      currentPoints: 90,
      goalPoints: 90,
      gap: 0,
    });
  });
});
