/**
 * Minimal Army memorandum (AR 25-50 style) renderer built on pdf-lib.
 *
 * Produces the ABCP enrollment paperwork mandated by Army Directive 2026-13 /
 * HQDA EXORD 182-26 — the commander's counseling, the Soldier's
 * acknowledgement, and the medical-evaluation request. Layout is a practical
 * draft (Helvetica, 1" margins, centered letterhead, numbered paragraphs with
 * lettered sub-paragraphs, centered signature block); units can print, adjust,
 * and sign.
 */
import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

export type MemoParagraph = {
  text: string;
  /** Lettered sub-paragraphs (a., b., c., …). */
  subs?: string[];
};

export type ArmyMemoDoc = {
  /** Centered header lines, e.g. ["DEPARTMENT OF THE ARMY", "HHD, 1st Bn", "Fort X, ST 00000"]. */
  letterhead: string[];
  officeSymbol: string;
  /** Formatted date, e.g. "31 July 2026". */
  date: string;
  /** Leading keyword, default "MEMORANDUM FOR" (Annex C uses "MEMORANDUM"). */
  memoLabel?: string;
  /** The addressee, e.g. "Commander, HHD, 1-1 IN" or "(SGT Doe, HHD 1-1 IN)". */
  memoFor: string;
  subject: string;
  paragraphs: MemoParagraph[];
  /** Signature-block lines, e.g. ["DARREN J. HAGAN", "MAJ, MI", "Commanding"]. */
  signatureBlock: string[];
};

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 72; // 1 inch
const FONT_SIZE = 12;
const LINE = 14;
const SUB_INDENT = 18; // 0.25"
const CONTENT_W = PAGE_W - MARGIN * 2;

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export async function renderArmyMemo(doc: ArmyMemoDoc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPageIfNeeded = (needed: number) => {
    if (y - needed < MARGIN) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  const drawCentered = (text: string, f: PDFFont, size: number) => {
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (PAGE_W - w) / 2, y, size, font: f });
    y -= LINE;
  };

  const drawAt = (text: string, x: number, f: PDFFont = font, size = FONT_SIZE) => {
    page.drawText(text, { x, y, size, font: f });
  };

  // Letterhead.
  for (const [i, lineText] of doc.letterhead.entries()) {
    drawCentered(lineText, i === 0 ? bold : font, i === 0 ? 10 : 8);
  }
  y -= LINE * 2;

  // Office symbol (left) + date (right).
  drawAt(doc.officeSymbol, MARGIN);
  const dateW = font.widthOfTextAtSize(doc.date, FONT_SIZE);
  drawAt(doc.date, PAGE_W - MARGIN - dateW);
  y -= LINE * 2;

  // MEMORANDUM FOR (or bare MEMORANDUM for a memo-for-record).
  const label = doc.memoLabel ?? "MEMORANDUM FOR";
  const memoLines = wrap(`${label} ${doc.memoFor}`, font, FONT_SIZE, CONTENT_W);
  for (const l of memoLines) {
    drawAt(l, MARGIN);
    y -= LINE;
  }
  y -= LINE;

  // SUBJECT.
  const subjLines = wrap(`SUBJECT: ${doc.subject}`, font, FONT_SIZE, CONTENT_W);
  for (const l of subjLines) {
    drawAt(l, MARGIN);
    y -= LINE;
  }
  y -= LINE;

  // Numbered paragraphs with lettered sub-paragraphs.
  const drawLabeled = (label: string, text: string, baseX: number) => {
    const labelW = font.widthOfTextAtSize(`${label}  `, FONT_SIZE);
    const textX = baseX + labelW;
    const lines = wrap(text, font, FONT_SIZE, PAGE_W - MARGIN - textX);
    newPageIfNeeded(LINE * lines.length);
    lines.forEach((l, i) => {
      if (i === 0) drawAt(label, baseX);
      drawAt(l, textX);
      y -= LINE;
    });
  };

  doc.paragraphs.forEach((p, idx) => {
    drawLabeled(`${idx + 1}.`, p.text, MARGIN);
    if (p.subs?.length) {
      p.subs.forEach((sub, sidx) => {
        const letter = String.fromCharCode(97 + sidx); // a, b, c…
        drawLabeled(`${letter}.`, sub, MARGIN + SUB_INDENT);
      });
    }
    y -= LINE; // blank line between paragraphs
  });

  // Signature block, centered horizontally on the page (AR 25-50).
  y -= LINE * 3;
  newPageIfNeeded(LINE * doc.signatureBlock.length);
  const sigX = PAGE_W / 2;
  for (const l of doc.signatureBlock) {
    drawAt(l, sigX);
    y -= LINE;
  }

  return pdf.save();
}

/** Army long-date format: "31 July 2026". */
export function longDate(d: Date = new Date()): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
