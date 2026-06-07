/**
 * Body composition helpers.
 *
 * - **WHtR** (Waist-to-Height Ratio): simple waist/height, increasingly used as
 *   a screening tool. Reference: WHO 2008 + 2024 NIH (PMC5118501).
 * - **Tape-test body fat %**: the Army/DoD circumference method.
 *   Male:   86.010·log10(abdomen − neck) − 70.041·log10(height) + 36.76
 *   Female: 163.205·log10(waist + hip − neck) − 97.684·log10(height) − 78.387
 *   All measurements in inches. AR 600-9 / DODI 1308.3.
 *
 * The Army is transitioning toward a single-site abdominal method and WHtR
 * for screening; many Guard units are still using the multi-site tape test.
 * We compute whichever values the user has measurements for.
 */

export type Sex = "MC" | "F";

export type Measurements = {
  waistIn?: number;
  neckIn?: number;
  hipIn?: number;
  abdomenIn?: number;
};

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
 * Tape-test body fat percentage.
 * Returns null if the required inputs for the given sex are missing.
 */
export function tapeBodyFatPct(args: {
  sex: Sex;
  heightIn: number | undefined;
  measurements: Measurements;
}): number | null {
  const { sex, heightIn, measurements } = args;
  if (!heightIn || heightIn <= 0) return null;
  const m = measurements;

  if (sex === "MC") {
    // Male formula: needs abdomen and neck.
    const abdomen = m.abdomenIn ?? m.waistIn;
    const neck = m.neckIn;
    if (!abdomen || !neck) return null;
    if (abdomen <= neck) return null;
    const bf =
      86.01 * Math.log10(abdomen - neck) -
      70.041 * Math.log10(heightIn) +
      36.76;
    return roundOne(Math.max(0, Math.min(60, bf)));
  } else {
    // Female formula: needs waist + hip + neck.
    const waist = m.waistIn;
    const hip = m.hipIn;
    const neck = m.neckIn;
    if (!waist || !hip || !neck) return null;
    if (waist + hip <= neck) return null;
    const bf =
      163.205 * Math.log10(waist + hip - neck) -
      97.684 * Math.log10(heightIn) -
      78.387;
    return roundOne(Math.max(0, Math.min(60, bf)));
  }
}

function roundOne(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Army age-/sex-based body fat % standard (AR 600-9).
 * Returns the maximum allowable BF% for the given age and sex.
 */
export function armyBodyFatMaxPct(age: number, sex: Sex): number {
  if (sex === "MC") {
    if (age <= 20) return 20;
    if (age <= 27) return 22;
    if (age <= 39) return 24;
    return 26;
  }
  if (age <= 20) return 30;
  if (age <= 27) return 32;
  if (age <= 39) return 34;
  return 36;
}
