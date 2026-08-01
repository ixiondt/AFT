/**
 * Body composition helpers.
 *
 * **Policy (Army Directive 2026-13, effective 1 Jul 2026):** the
 * Waist-to-Height Ratio (WHtR) is the *sole* authorized Army body-composition
 * standard. Height/weight screening tables are discontinued and the
 * circumference (tape) body-fat test is abolished — no tape/DXA/InBody appeal,
 * and no AFT high-scorer exemption (AD 2025-17 rescinded).
 *
 * Compliance rule:
 * - WHtR = average waist (in) ÷ height (in). Waist is measured at the navel and
 *   rounded *down* to the nearest 0.5" (`roundDownHalfInch`); height is rounded
 *   to the nearest 0.5" (`roundNearestHalfInch`). Waist is measured three times
 *   and averaged (`averageWaist`).
 * - The recorded WHtR is **truncated** to three decimals — digits past the
 *   third are disregarded, NOT rounded (`truncateWhtR3`): 0.549888 → 0.549.
 * - **< 0.550 passes; ≥ 0.550 fails** (see `ARMY_WHTR_MAX` / `whtRArmyPass`).
 *   A failing ratio flags the Soldier (flag code K) into the Army Body
 *   Composition Program (ABCP). WHtR is recorded on DA Form 5500 (Jul 2026) and
 *   in ATIS; DA Form 5501 is rescinded.
 * - Measured at least twice per calendar year. If the initial WHtR is ≥ 0.550,
 *   a confirmation measurement by a different team is taken the same duty day
 *   before any command action.
 *
 * The finer `whtRBand` values (healthy < 0.5, etc.) are WHO 2008 / 2024 NIH
 * (PMC5118501) *health-risk* context, NOT the compliance test.
 *
 * The retired circumference (tape) body-fat method and its age/sex ceilings
 * (AR 600-9) have been removed entirely — they no longer gate compliance.
 */

export type Sex = "MC" | "F";

export type WhtRBand = "healthy" | "increased" | "high" | "very_high";

export function whtR(waistIn: number | undefined, heightIn: number | undefined): number | null {
  if (!waistIn || !heightIn || waistIn <= 0 || heightIn <= 0) return null;
  return waistIn / heightIn;
}

export function whtRBand(ratio: number): WhtRBand {
  if (ratio < 0.5) return "healthy";
  if (ratio < 0.6) return "increased";
  if (ratio < 0.7) return "high";
  return "very_high";
}

export function whtRBandLabel(band: WhtRBand): string {
  switch (band) {
    case "healthy":
      return "Healthy";
    case "increased":
      return "Increased risk";
    case "high":
      return "High risk";
    case "very_high":
      return "Very high risk";
  }
}

/**
 * The Army body-composition compliance threshold (waist ÷ height), per Army
 * Directive 2026-13. The *recorded* (3-decimal, truncated) WHtR must be
 * **< 0.550** to pass; **≥ 0.550** triggers a flag (code K) and enrollment in
 * the Army Body Composition Program. This is the *only* authorized standard —
 * no tape/DXA appeal, no AFT-score exemption.
 */
export const ARMY_WHTR_MAX = 0.55;

/**
 * Truncate a WHtR to three decimals per DA Form 5500 rules: digits past the
 * third decimal are disregarded (NOT rounded). 0.549888 → 0.549, 0.5501 → 0.550.
 * The `1e-9` nudge absorbs binary-float dust so an exact boundary such as
 * 33/60 = 0.550 truncates to 0.550, not 0.549.
 */
export function truncateWhtR3(ratio: number): number {
  if (!Number.isFinite(ratio)) return ratio;
  return Math.floor(ratio * 1000 + 1e-9) / 1000;
}

/**
 * True when the WHtR meets the Army standard. Applies the DA 5500 truncation
 * first, then the strict "< 0.550" test, so it matches the value a Soldier
 * would actually see recorded on the worksheet.
 */
export function whtRArmyPass(ratio: number): boolean {
  return truncateWhtR3(ratio) < ARMY_WHTR_MAX;
}

/** Round *down* to the nearest 0.5" — the waist-measurement rule (TAPE guidance). */
export function roundDownHalfInch(inches: number): number {
  return Math.floor(inches * 2) / 2;
}

/** Round to the *nearest* 0.5" — the height-measurement rule (TAPE guidance). */
export function roundNearestHalfInch(inches: number): number {
  return Math.round(inches * 2) / 2;
}

/**
 * Average the waist measurements per DA Form 5500 / TAPE team guidance: three
 * readings, each already rounded down to the nearest 0.5". If more than three
 * are supplied (a Soldier whose spread exceeded 1" and was re-measured), the
 * three closest readings are averaged. Result is rounded to three decimals for
 * the worksheet's "average" cell. Returns null with fewer than three valid
 * readings.
 */
export function averageWaist(readings: Array<number | undefined | null>): number | null {
  const vals = readings.filter((v): v is number => typeof v === "number" && v > 0);
  if (vals.length < 3) return null;

  let chosen: number[];
  if (vals.length === 3) {
    chosen = vals;
  } else {
    // Slide a window of 3 over the sorted readings; keep the tightest cluster.
    const sorted = [...vals].sort((a, b) => a - b);
    let best = sorted.slice(0, 3);
    let bestRange = Math.max(...best) - Math.min(...best);
    for (let i = 1; i + 3 <= sorted.length; i++) {
      const window = sorted.slice(i, i + 3);
      const range = Math.max(...window) - Math.min(...window);
      if (range < bestRange) {
        best = window;
        bestRange = range;
      }
    }
    chosen = best;
  }

  const mean = chosen.reduce((sum, v) => sum + v, 0) / chosen.length;
  return Math.round(mean * 1000) / 1000;
}
