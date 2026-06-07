/**
 * Fill the DA 5500 (male) / DA 5501 (female) Body Fat Content Worksheets
 * using the current Army single-site standard (ALARACT 053/2024).
 *
 * The cleaned templates live in `data/forms/da5500.pdf` and
 * `data/forms/da5501.pdf` — they were round-tripped through pikepdf
 * to strip restrictions + rebuild the xref table so pdf-lib can read them.
 *
 * For DA 5501 we fill page 2 (the new single-site page). Page 1 still
 * carries the legacy multi-site method for units transitioning.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, type PDFForm } from "pdf-lib";

const FORMS_DIR = path.join(process.cwd(), "data", "forms");

export type DaFormData = {
  name: string;
  rank?: string;
  heightIn: number;
  weightLb: number;
  age: number;
  abdomenIn: number;
  bodyFatPct: number;
  /** Army max BF% for the soldier's age/sex; drives compliance checkbox. */
  maxBfPct: number;
  /** Optional remarks/notes. */
  remarks?: string;
  /** Optional name/rank of the prepared-by official. */
  preparedByName?: string;
  preparedByRank?: string;
  /** YYYYMMDD. Defaults to today. */
  date: string;
};

function setText(form: PDFForm, name: string, value: string): void {
  try {
    form.getTextField(name).setText(value);
  } catch {
    /* field may not exist on every page; ignore */
  }
}

function setChecked(form: PDFForm, name: string, checked: boolean): void {
  try {
    const cb = form.getCheckBox(name);
    if (checked) cb.check();
    else cb.uncheck();
  } catch {
    /* ignore */
  }
}

function fillSingleSitePage(
  form: PDFForm,
  pagePrefix: string,
  data: DaFormData,
): void {
  const compliant = data.bodyFatPct <= data.maxBfPct;
  const abd = data.abdomenIn.toFixed(1);
  const bf = data.bodyFatPct.toFixed(1);
  const wt = data.weightLb.toString();

  setText(form, `${pagePrefix}.Name[0]`, data.name);
  if (data.rank) setText(form, `${pagePrefix}.Rank[0]`, data.rank);
  setText(form, `${pagePrefix}.Height[0]`, data.heightIn.toFixed(1));
  setText(form, `${pagePrefix}.Weight[0]`, wt);
  setText(form, `${pagePrefix}.Age[0]`, data.age.toString());
  setText(form, `${pagePrefix}.Weight2[0]`, wt);

  // Single-site: enter the same measured value for all 3 attempts + average
  setText(form, `${pagePrefix}.Abdomen_1st[0]`, abd);
  setText(form, `${pagePrefix}.Abdomen_2nd[0]`, abd);
  setText(form, `${pagePrefix}.Abdomen_3rd[0]`, abd);
  setText(form, `${pagePrefix}.Abdomen_Average[0]`, abd);
  setText(form, `${pagePrefix}.Abdominal_Circumference[0]`, abd);

  setText(form, `${pagePrefix}.Item_4_Percentage_Body_Fat[0]`, bf);
  setText(form, `${pagePrefix}.Item_5_Percentage_Body_Fat[0]`, bf);

  setChecked(form, `${pagePrefix}.Is_Compliance[0]`, compliant);
  setChecked(form, `${pagePrefix}.Is_Not_Compliance[0]`, !compliant);

  if (data.remarks) setText(form, `${pagePrefix}.Remarks[0]`, data.remarks);

  setText(form, `${pagePrefix}.Prepared_By_Date[0]`, data.date);
  if (data.preparedByName)
    setText(form, `${pagePrefix}.Name_Prepared_By[0]`, data.preparedByName);
  if (data.preparedByRank)
    setText(form, `${pagePrefix}.Rank_Prepared_By[0]`, data.preparedByRank);
}

async function fillDa(
  templateFile: string,
  pagePrefix: string,
  data: DaFormData,
): Promise<Uint8Array> {
  const bytes = await fs.readFile(path.join(FORMS_DIR, templateFile));
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();
  fillSingleSitePage(form, pagePrefix, data);
  return doc.save();
}

export function fillDa5500(data: DaFormData): Promise<Uint8Array> {
  return fillDa("da5500.pdf", "form1[0].Page1[0]", data);
}

export function fillDa5501(data: DaFormData): Promise<Uint8Array> {
  // DA 5501 page 2 = new single-site method (page 1 stays as the legacy
  // multi-site reference, untouched).
  return fillDa("da5501.pdf", "form1[0].Page2[0]", data);
}

/** Format YYYYMMDD from a Date. */
export function ddmmmyyyy(d: Date = new Date()): string {
  const day = d.getUTCDate().toString().padStart(2, "0");
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const mon = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day} ${mon} ${year}`;
}
