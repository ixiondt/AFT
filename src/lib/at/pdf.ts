import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { AtPlan } from "./types";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Helvetica/WinAnsi can't encode the glyphs our UI uses (em dash, bullet,
 * multiply sign, arrows, ≤, ♿, etc.). Map them to ASCII before drawing or
 * pdf-lib throws at render time.
 */
function ascii(s: string): string {
  return s
    .replace(/[—–]/g, "-")
    .replace(/[•·]/g, "-")
    .replace(/×/g, "x")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/→/g, "->")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/♿/g, "")
    // Drop anything still outside the printable ASCII range.
    .replace(/[^\x20-\x7e]/g, "");
}

const PAGE = { w: 612, h: 792, margin: 54 };
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.42, 0.42, 0.46);

/** Render an AT plan to a single-column, paginated PDF. Pure — returns bytes. */
export async function renderAtPlanPdf(plan: AtPlan): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage([PAGE.w, PAGE.h]);
  let y = PAGE.h - PAGE.margin;

  const newPage = () => {
    page = doc.addPage([PAGE.w, PAGE.h]);
    y = PAGE.h - PAGE.margin;
  };

  const line = (
    text: string,
    opts: { size?: number; font?: PDFFont; indent?: number; color?: typeof INK; gap?: number } = {},
  ) => {
    const size = opts.size ?? 10;
    const f = opts.font ?? font;
    const indent = opts.indent ?? 0;
    const lineHeight = size + (opts.gap ?? 4);
    if (y - lineHeight < PAGE.margin) newPage();
    // Naive wrap at the content width.
    const maxWidth = PAGE.w - PAGE.margin * 2 - indent;
    for (const seg of wrap(ascii(text), f, size, maxWidth)) {
      if (y - lineHeight < PAGE.margin) newPage();
      page.drawText(seg, {
        x: PAGE.margin + indent,
        y: y - size,
        size,
        font: f,
        color: opts.color ?? INK,
      });
      y -= lineHeight;
    }
  };

  const space = (h = 8) => {
    y -= h;
    if (y < PAGE.margin) newPage();
  };

  const heading = (text: string) => {
    space(6);
    line(text, { size: 12, font: bold });
    space(2);
  };

  // ---- Header ----
  line(plan.unitName, { size: 18, font: bold });
  line(`Annual Training PT · start ${plan.startDateISO} · ${plan.days} days`, {
    size: 10,
    color: MUTED,
  });

  if (plan.warnings.length) {
    heading("Before you start");
    for (const w of plan.warnings) line(`- ${w}`, { indent: 8 });
  }

  // ---- Ability groups ----
  heading("Ability groups");
  for (const g of plan.groups) {
    const bits = [`${g.memberIds.length} soldier(s)`];
    if (g.prescribedPacePerMileSec !== undefined) bits.push(`lead ${mmss(g.prescribedPacePerMileSec)}/mi`);
    if (g.modality) bits.push(`modality ${g.modality}`);
    line(`${g.label} — ${g.description}`, { font: bold, size: 10 });
    line(bits.join(" · "), { indent: 10, color: MUTED, size: 9 });
  }

  // ---- Daily schedule ----
  heading("Daily schedule");
  for (const d of plan.schedule) {
    line(`Day ${d.dayIndex + 1} · ${DOW[d.dayOfWeek]} ${d.dateISO} — ${d.title}`, {
      font: bold,
      size: 10,
    });
    if (d.rest) {
      line(d.activities[0] ?? "Rest", { indent: 10, color: MUTED, size: 9 });
    } else {
      const block = (label: string, lines: readonly string[]) => {
        line(label, { indent: 10, size: 9, color: MUTED });
        for (const l of lines) line(l, { indent: 20, size: 9 });
      };
      block("Preparation", d.preparation);
      block("Activities", d.activities);
      block("Recovery", d.recovery);
    }
    space(4);
  }

  // ---- Per-soldier cards ----
  if (plan.cards.length) {
    heading("Per-soldier cards");
    for (const c of plan.cards) {
      line(`${c.displayName}  [${c.abilityGroup}]`, { font: bold, size: 10 });
      if (c.aftScore) {
        const s = c.aftScore;
        const detail = s.profiled
          ? ` / ${s.scoredEventCount} events${s.isRecord ? "" : " (diagnostic)"}`
          : "";
        line(`AFT: ${s.total} pts${detail} - ${s.pass ? "pass" : "fail"}`, { indent: 10, size: 9 });
      }
      line(`Run: ${c.runPrescription}`, { indent: 10, size: 9 });
      line(`Strength: ${c.strengthPrescription}`, { indent: 10, size: 9 });
      for (const a of c.accommodations) line(`Accommodation: ${a}`, { indent: 10, size: 9, color: MUTED });
      for (const n of c.notes) line(n, { indent: 10, size: 9, color: MUTED });
      space(4);
    }
  }

  return doc.save();
}

function mmss(total: number): string {
  const t = Math.round(total);
  return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, "0")}`;
}

/** Greedy word-wrap to a pixel width for a given font/size. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}
