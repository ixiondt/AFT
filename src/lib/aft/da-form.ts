/**
 * Fill the DA Form 5500 (Jul 2026) — the Army Body Composition Screening and
 * Assessment Worksheet — from a Soldier's WHtR measurement.
 *
 * Per Army Directive 2026-13, DA 5500 records the Waist-to-Height Ratio for
 * *all* Soldiers (one form, both sexes). The old body-fat DA 5500/5501 pair is
 * retired and DA 5501 is rescinded.
 *
 * The template lives in `data/forms/da5500.pdf` — round-tripped through pikepdf
 * (see `scripts/clean-da-forms-pikepdf.py`) to strip encryption + rebuild the
 * xref table so pdf-lib can read it.
 *
 * Radio export values were mapped empirically against the widget positions
 * (pdf-lib exposes its own option names that differ from the raw PDF states):
 *   - Sex:        Male → "2", Female → "1"
 *   - Compliance: compliant → "1", not compliant → "2"
 */
import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, type PDFForm } from "pdf-lib";
import type { Sex } from "./body-comp";

const FORMS_DIR = path.join(process.cwd(), "data", "forms");
const PAGE = "form1[0].Page1[0]";

const SEX_OPTION: Record<Sex, string> = { MC: "2", F: "1" };
const COMPLY_YES = "1";
const COMPLY_NO = "2";

export type WhtrMeasurement = {
  /** Waist readings in inches, each rounded down to the nearest 0.5". */
  waistReadings: number[];
  /** Average waist to three decimals. */
  waistAverage: number;
  /** WHtR truncated to three decimals. */
  whtr: number;
};

export type DaFormData = {
  name: string;
  rank?: string;
  sex: Sex;
  /** Height in inches, rounded to the nearest 0.5". */
  heightIn: number;
  age: number;
  /** Initial measurement. */
  initial: WhtrMeasurement;
  /** True when the (truncated) WHtR meets the standard (< 0.550). */
  compliant: boolean;
  /** Optional same-day confirmation measurement (initial WHtR ≥ 0.550). */
  confirmation?: WhtrMeasurement;
  remarks?: string;
  preparedByName?: string;
  preparedByRank?: string;
  approvedByName?: string;
  approvedByRank?: string;
  /** YYYYMMDD. Defaults to today. */
  date: string;
};

function setText(form: PDFForm, name: string, value: string): void {
  try {
    form.getTextField(`${PAGE}.${name}[0]`).setText(value);
  } catch {
    /* field may not exist; ignore */
  }
}

function selectRadio(form: PDFForm, name: string, option: string): void {
  try {
    form.getRadioGroup(`${PAGE}.${name}[0]`).select(option);
  } catch {
    /* ignore */
  }
}

/** Inches with a single decimal, e.g. 34 → "34.0", 34.5 → "34.5". */
function inches(n: number): string {
  return n.toFixed(1);
}

function fillMeasurement(
  form: PDFForm,
  m: WhtrMeasurement,
  suffix: "" | "_Confirmation",
): void {
  const [w1, w2, w3] = m.waistReadings;
  if (w1 !== undefined) setText(form, `Waist_1${suffix}`, inches(w1));
  if (w2 !== undefined) setText(form, `Waist_2${suffix}`, inches(w2));
  if (w3 !== undefined) setText(form, `Waist_3${suffix}`, inches(w3));
  setText(form, `Waist_Average${suffix}`, m.waistAverage.toFixed(3));
  // The template names the initial ratio field differently from the
  // confirmation one: Waist_To_Height_Ratio vs Waist_To_Height_Confirmation.
  const ratioField = suffix ? "Waist_To_Height_Confirmation" : "Waist_To_Height_Ratio";
  setText(form, ratioField, m.whtr.toFixed(3));
}

export async function fillDa5500(data: DaFormData): Promise<Uint8Array> {
  const bytes = await fs.readFile(path.join(FORMS_DIR, "da5500.pdf"));
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();

  setText(form, "Name", data.name);
  if (data.rank) setText(form, "Rank", data.rank);
  setText(form, "Height", inches(data.heightIn));
  setText(form, "Age", data.age.toString());
  selectRadio(form, "Radio_Button_Group_Sex", SEX_OPTION[data.sex]);

  fillMeasurement(form, data.initial, "");
  if (data.confirmation) fillMeasurement(form, data.confirmation, "_Confirmation");

  selectRadio(form, "Compliance_Group", data.compliant ? COMPLY_YES : COMPLY_NO);

  if (data.remarks) setText(form, "Remarks", data.remarks);

  if (data.preparedByName) setText(form, "Name_Prepared_By", data.preparedByName);
  if (data.preparedByRank) setText(form, "Rank_Prepared_By", data.preparedByRank);
  setText(form, "Prepared_By_Date", data.date);
  if (data.approvedByName) setText(form, "Name_Approved_By", data.approvedByName);
  if (data.approvedByRank) setText(form, "Rank_Approved_By", data.approvedByRank);
  if (data.approvedByName || data.approvedByRank)
    setText(form, "Approved_By_Date", data.date);

  return doc.save();
}

/** Format YYYYMMDD from a Date (the DA 5500 date fields' format). */
export function yyyymmdd(d: Date = new Date()): string {
  const year = d.getUTCFullYear();
  const mon = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = d.getUTCDate().toString().padStart(2, "0");
  return `${year}${mon}${day}`;
}
