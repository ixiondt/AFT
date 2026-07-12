import { describe, expect, it } from "vitest";
import {
  ARMY_WHTR_MAX,
  tapeBodyFatPct,
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

describe("whtRArmyPass — the 0.55 compliance line", () => {
  it("exposes the standard as a constant", () => {
    expect(ARMY_WHTR_MAX).toBe(0.55);
  });
  it("passes strictly below 0.55", () => {
    expect(whtRArmyPass(0.54)).toBe(true);
    expect(whtRArmyPass(0.5499)).toBe(true);
  });
  it("fails at or above 0.55", () => {
    expect(whtRArmyPass(0.55)).toBe(false);
    expect(whtRArmyPass(0.6)).toBe(false);
  });
  it("is independent of the finer health-risk bands", () => {
    // 0.52 is 'increased risk' health-wise but still PASSES the Army standard.
    expect(whtRBand(0.52)).toBe("increased");
    expect(whtRArmyPass(0.52)).toBe(true);
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

describe("tapeBodyFatPct — legacy single-site (reference only)", () => {
  it("falls back to waist when abdomen is absent", () => {
    const withAbdomen = tapeBodyFatPct({
      sex: "MC",
      weightLb: 200,
      measurements: { abdomenIn: 38 },
    });
    const withWaist = tapeBodyFatPct({
      sex: "MC",
      weightLb: 200,
      measurements: { waistIn: 38 },
    });
    expect(withAbdomen).not.toBeNull();
    expect(withWaist).toBe(withAbdomen);
  });
  it("returns null without weight or abdomen/waist", () => {
    expect(
      tapeBodyFatPct({ sex: "F", weightLb: undefined, measurements: { abdomenIn: 30 } }),
    ).toBeNull();
    expect(
      tapeBodyFatPct({ sex: "F", weightLb: 150, measurements: {} }),
    ).toBeNull();
  });
});
