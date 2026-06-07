/**
 * Body composition helpers.
 *
 * - **WHtR** (Waist-to-Height Ratio): simple waist/height. Reference: WHO 2008
 *   + 2024 NIH (PMC5118501). Healthy < 0.5.
 * - **Army body fat %** (single-site, ALARACT 053/2024, effective 9 Jun 2024):
 *     Male:   %BF = -26.97 - 0.12·weight_lb + 1.99·abdomen_in
 *     Female: %BF =  -9.15 - 0.015·weight_lb + 1.27·abdomen_in
 *   Height is NOT in the BF% formula (only used here for WHtR). Age is NOT in
 *   the formula either — it only sets the pass/fail max via armyBodyFatMaxPct.
 * - **Legacy multi-site (Hodgdon-Beckett)** — what Guard units used before
 *   the 2024 update; still exposed via tapeBodyFatPctMultiSite() for
 *   comparison while units transition.
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
 * Body fat % using the current Army single-site standard
 * (ALARACT 053/2024, effective 9 Jun 2024). Both sexes use the same shape:
 * a regression on bodyweight (lb) + abdominal circumference at the navel (in).
 * Height and age are NOT inputs to the formula itself.
 *
 * Returns null if either weight or abdomen is missing.
 */
export function tapeBodyFatPct(args: {
  sex: Sex;
  weightLb: number | undefined;
  measurements: Measurements;
}): number | null {
  const { sex, weightLb, measurements } = args;
  if (!weightLb || weightLb <= 0) return null;
  const abdomen = measurements.abdomenIn ?? measurements.waistIn;
  if (!abdomen || abdomen <= 0) return null;

  const bf =
    sex === "MC"
      ? -26.97 - 0.12 * weightLb + 1.99 * abdomen
      : -9.15 - 0.015 * weightLb + 1.27 * abdomen;

  return roundOne(Math.max(0, Math.min(60, bf)));
}

/**
 * Legacy multi-site tape formula (Hodgdon-Beckett). Useful for comparison
 * against the new single-site number while Guard units transition.
 */
export function tapeBodyFatPctMultiSite(args: {
  sex: Sex;
  heightIn: number | undefined;
  measurements: Measurements;
}): number | null {
  const { sex, heightIn, measurements } = args;
  if (!heightIn || heightIn <= 0) return null;
  const m = measurements;
  if (sex === "MC") {
    const abdomen = m.abdomenIn ?? m.waistIn;
    const neck = m.neckIn;
    if (!abdomen || !neck || abdomen <= neck) return null;
    const bf =
      86.01 * Math.log10(abdomen - neck) -
      70.041 * Math.log10(heightIn) +
      36.76;
    return roundOne(Math.max(0, Math.min(60, bf)));
  }
  const waist = m.waistIn;
  const hip = m.hipIn;
  const neck = m.neckIn;
  if (!waist || !hip || !neck || waist + hip <= neck) return null;
  const bf =
    163.205 * Math.log10(waist + hip - neck) -
    97.684 * Math.log10(heightIn) -
    78.387;
  return roundOne(Math.max(0, Math.min(60, bf)));
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
