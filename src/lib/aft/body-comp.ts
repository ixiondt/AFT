/**
 * Body composition helpers.
 *
 * - **WHtR** (Waist-to-Height Ratio): simple waist/height. Reference: WHO 2008
 *   + 2024 NIH (PMC5118501). Healthy < 0.5.
 * - **Body fat %**:
 *   - **Male — Army single-site (current standard, AR 600-9 update Jan 2024):**
 *     Single abdominal circumference at the navel. No neck.
 *     %BF ≈ 0.74·abdomen − 0.34·height + 0.10·age + 14.43 (inches/years)
 *   - **Female — multi-site tape (Hodgdon-Beckett, still current):**
 *     %BF = 163.205·log10(waist + hip − neck) − 97.684·log10(height) − 78.387
 *
 * The single-site male formula is an inches-unit approximation of the
 * abdomen/height/age regression the Army adopted with the new ABCP. Guard
 * units waiting for guidance commonly still use the Hodgdon-Beckett
 * abdomen−neck/height multi-site formula — we expose that too via
 * tapeBodyFatPctMultiSite() in case you want the legacy number for comparison.
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
 * Body fat % using the current Army standard.
 * - Male: single-site (abdomen + height + age). NO neck required.
 * - Female: multi-site (waist + hip + neck + height).
 * Returns null if the required inputs for the given sex are missing.
 */
export function tapeBodyFatPct(args: {
  sex: Sex;
  age?: number;
  heightIn: number | undefined;
  measurements: Measurements;
}): number | null {
  const { sex, age, heightIn, measurements } = args;
  if (!heightIn || heightIn <= 0) return null;
  const m = measurements;

  if (sex === "MC") {
    // Single-site: abdomen at the navel + height + age.
    const abdomen = m.abdomenIn ?? m.waistIn;
    if (!abdomen) return null;
    const ageVal = typeof age === "number" && age > 0 ? age : 30;
    const bf = 0.74 * abdomen - 0.34 * heightIn + 0.10 * ageVal + 14.43;
    return roundOne(Math.max(0, Math.min(60, bf)));
  }
  // Female multi-site stays as Hodgdon-Beckett (still current).
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
