import { describe, expect, it } from "vitest";
import {
  ARMY_WHTR_MAX,
  averageWaist,
  roundDownHalfInch,
  roundNearestHalfInch,
  truncateWhtR3,
  whtR,
  whtRArmyPass,
  whtRBand,
} from "./body-comp";

describe("whtR", () => {
  it("computes waist / height", () => {
    expect(whtR(34, 68)).toBeCloseTo(0.5, 5);
  });
  it("returns null for missing or non-positive inputs", () => {
    expect(whtR(undefined, 68)).toBeNull();
    expect(whtR(34, undefined)).toBeNull();
    expect(whtR(0, 68)).toBeNull();
    expect(whtR(34, 0)).toBeNull();
  });
});

describe("truncateWhtR3 — DA 5500 recording precision", () => {
  it("truncates (does not round) to three decimals", () => {
    expect(truncateWhtR3(0.549888)).toBe(0.549);
    expect(truncateWhtR3(0.5499)).toBe(0.549);
    expect(truncateWhtR3(0.5555)).toBe(0.555);
  });
  it("holds an exact boundary against float dust", () => {
    // 33 / 60 = 0.550 exactly; must not slip to 0.549.
    expect(truncateWhtR3(33 / 60)).toBe(0.55);
    expect(truncateWhtR3(27.5 / 50)).toBe(0.55);
  });
  it("passes non-finite values through untouched", () => {
    expect(Number.isNaN(truncateWhtR3(NaN))).toBe(true);
  });
});

describe("whtRArmyPass — the 0.550 compliance line", () => {
  it("exposes the standard as a constant", () => {
    expect(ARMY_WHTR_MAX).toBe(0.55);
  });
  it("passes strictly below 0.550 (on the truncated value)", () => {
    expect(whtRArmyPass(0.54)).toBe(true);
    expect(whtRArmyPass(0.5499)).toBe(true);
    // Truncates to 0.549 → passes even though the raw value rounds to 0.550.
    expect(whtRArmyPass(0.549999)).toBe(true);
  });
  it("fails at or above 0.550", () => {
    expect(whtRArmyPass(0.55)).toBe(false);
    expect(whtRArmyPass(0.5501)).toBe(false);
    expect(whtRArmyPass(0.6)).toBe(false);
  });
  it("is independent of the finer health-risk bands", () => {
    // 0.52 is 'increased risk' health-wise but still PASSES the Army standard.
    expect(whtRBand(0.52)).toBe("increased");
    expect(whtRArmyPass(0.52)).toBe(true);
  });
});

describe("measurement rounding — TAPE team guidance", () => {
  it("rounds waist DOWN to the nearest 0.5 inch", () => {
    expect(roundDownHalfInch(34.4)).toBe(34);
    expect(roundDownHalfInch(34.9)).toBe(34.5);
    expect(roundDownHalfInch(34.5)).toBe(34.5);
  });
  it("rounds height to the NEAREST 0.5 inch", () => {
    expect(roundNearestHalfInch(69.24)).toBe(69);
    expect(roundNearestHalfInch(69.26)).toBe(69.5);
    expect(roundNearestHalfInch(69.75)).toBe(70);
  });
});

describe("averageWaist", () => {
  it("averages three readings to three decimals", () => {
    expect(averageWaist([34, 34.5, 34])).toBe(34.167);
  });
  it("needs at least three valid readings", () => {
    expect(averageWaist([34, 34.5])).toBeNull();
    expect(averageWaist([34, undefined, null])).toBeNull();
  });
  it("averages the three closest when an extra reading is taken", () => {
    // 39.5 is the >1in outlier; the three closest (34, 34, 34.5) are averaged.
    expect(averageWaist([34, 34, 34.5, 39.5])).toBe(34.167);
  });
});

describe("whtRBand — health-risk context (not compliance)", () => {
  it("maps ratios to WHO/NIH bands", () => {
    expect(whtRBand(0.49)).toBe("healthy");
    expect(whtRBand(0.5)).toBe("increased");
    expect(whtRBand(0.6)).toBe("high");
    expect(whtRBand(0.75)).toBe("very_high");
  });
});

describe("whtR + truncation end-to-end", () => {
  it("truncates a computed ratio to the recorded value", () => {
    // 38 waist / 69 height = 0.55072... → recorded 0.550 → fails.
    const ratio = whtR(38, 69);
    expect(ratio).not.toBeNull();
    expect(truncateWhtR3(ratio as number)).toBe(0.55);
    expect(whtRArmyPass(ratio as number)).toBe(false);
  });
  it("a hair under the line passes on the truncated value", () => {
    // 37.5 / 69 = 0.54347... → 0.543 → passes.
    const ratio = whtR(37.5, 69) as number;
    expect(truncateWhtR3(ratio)).toBe(0.543);
    expect(whtRArmyPass(ratio)).toBe(true);
  });
});
