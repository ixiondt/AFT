/**
 * ABCP enrollment paperwork content, verbatim from HQDA EXORD 182-26 annexes
 * and the unit medical-evaluation template, expressed as Army-memo documents
 * for `renderArmyMemo`.
 *
 *   - Commander's Counseling ............ EXORD 182-26 Annex C
 *   - Soldier's Acknowledgement ......... EXORD 182-26 Annex D
 *   - Medical Evaluation Request ........ unit template (AD 2026-13 §5.b(4))
 *
 * Plus `evaluationEntry` — the OER/NCOER/AER WHtR entry per Annex B.
 */
import type { ArmyMemoDoc } from "./abcp-memo";

export type PaperworkParams = {
  date: string; // long date, e.g. "31 July 2026"
  officeSymbol?: string;
  orgName?: string;
  orgAddress?: string;
  orgCityStateZip?: string;
  unit?: string;
  soldierName?: string;
  soldierRank?: string;
  soldierBranch?: string; // e.g. "IN" or "USA"
  dodid?: string;
  commanderName?: string;
  commanderRank?: string; // e.g. "MAJ, MI"
  commanderTitle?: string; // e.g. "Commanding"
  pocName?: string;
  pocEmail?: string;
  pocPhone?: string;
};

const ph = (v: string | undefined, fallback: string): string =>
  v && v.trim() ? v.trim() : fallback;

function letterhead(p: PaperworkParams): string[] {
  return [
    "DEPARTMENT OF THE ARMY",
    ph(p.orgName, "[ORGANIZATION]"),
    ph(p.orgAddress, "[STREET ADDRESS]"),
    ph(p.orgCityStateZip, "[CITY, STATE ZIP]"),
  ];
}

function soldierLine(p: PaperworkParams): string {
  const rank = ph(p.soldierRank, "[Rank]");
  const name = ph(p.soldierName, "[Soldier's Name]");
  return `${rank} ${name}`.trim();
}

/** Commander's Body Composition Counseling — EXORD 182-26 Annex C. */
export function commanderCounselingMemo(p: PaperworkParams): ArmyMemoDoc {
  return {
    letterhead: letterhead(p),
    officeSymbol: ph(p.officeSymbol, "[OFFICE SYMBOL]"),
    date: p.date,
    memoLabel: "MEMORANDUM",
    memoFor: `(${soldierLine(p)}, ${ph(p.unit, "[Unit]")})`,
    subject:
      "Army Body Composition Supplemental Body Fat Assessment Counseling",
    paragraphs: [
      {
        text:
          "You have been determined to exceed the Army body composition standard using the waist to height ratio assessment. Effective today you are enrolled in the Army Body Composition Program (ABCP). While enrolled, you will complete the following:",
        subs: [
          "(Regular Army and Active Guard Reserve) Must meet with a registered dietician within 30 days of enrollment and provide a memorandum from the health care provider stating nutritional counseling took place.",
          "Participate in commanders' and self-directed physical fitness programs within the parameters of any existing temporary or permanent profile.",
          "Must schedule and complete a medical examination if Active Duty or are on Active Duty Orders. For Soldiers not Active Duty or on Active Duty orders, the medical examination is optional and at the Soldier's own expense.",
        ],
      },
      {
        text:
          "You have been flagged under the provisions of AR 600-8-2 and entered in a body composition program. A DA Form 268 (Report to Suspend Favorable Personnel Actions (FLAG)) has been placed in your record. Some ramifications of this flagging action include:",
        subs: [
          "You are nonpromotable (to the extent such nonpromotion is permitted by law).",
          "You will not be assigned to command, command sergeant major, or first sergeant positions.",
          "You are not authorized to attend professional military schools and institutional training courses.",
        ],
      },
      {
        text:
          "You must meet the waist to height ratio assessment standard to be released from the ABCP.",
      },
    ],
    signatureBlock: [
      ph(p.commanderName, "[Commander's Name]"),
      ph(p.commanderRank, "[Rank, Branch]"),
      ph(p.commanderTitle, "Commanding"),
    ],
  };
}

/** Soldier's Acknowledgement of Counseling — EXORD 182-26 Annex D. */
export function soldierAcknowledgementMemo(p: PaperworkParams): ArmyMemoDoc {
  return {
    letterhead: letterhead(p),
    officeSymbol: ph(p.officeSymbol, "[OFFICE SYMBOL]"),
    date: p.date,
    memoFor: `Commander, ${ph(p.unit, "[Unit]")}`,
    subject: "Army Body Composition Program Enrollment",
    paragraphs: [
      { text: "I understand my responsibilities to achieve the waist to height ratio standard." },
      {
        text:
          "I will participate in commanders' and self-directed physical fitness programs within the parameters of any existing temporary or permanent profile.",
      },
      {
        text:
          "(Regular Army and Active Guard Reserve Only). I will meet with a registered dietician or healthcare professional (in the absence of a dietitian) and provide you with a memorandum from the health care provider stating nutritional counseling took place.",
      },
      {
        text:
          "(Regular Army and Active Guard Reserve). I will meet with a healthcare professional for a required medical examination and provide you a memorandum from the health care provider stating the medical examination took place.",
      },
    ],
    signatureBlock: [
      ph(p.soldierName, "[Soldier's Name]"),
      `${ph(p.soldierRank, "[Rank]")}, ${ph(p.soldierBranch, "USA")}`,
    ],
  };
}

/** Medical Evaluation Request — AD 2026-13 §5.b(4), unit template. */
export function medicalEvaluationRequestMemo(p: PaperworkParams): ArmyMemoDoc {
  const dodid = ph(p.dodid, "[DODID]");
  const poc = ph(p.pocName, "[POC name]");
  const email = ph(p.pocEmail, "[email]");
  const phone = ph(p.pocPhone, "[phone]");
  return {
    letterhead: letterhead(p),
    officeSymbol: ph(p.officeSymbol, "[OFFICE SYMBOL]"),
    date: p.date,
    memoFor: `Commander, ${ph(p.unit, "[Unit Name, Installation, Zip Code]")}`,
    subject: `Medical Evaluation Results – ${soldierLine(p)}, ${dodid}`,
    paragraphs: [
      {
        text:
          "I am requesting the above-named Soldier be evaluated in accordance with AR 600-9 to determine if there is an underlying medical condition related to weight gain or the inability to lose weight.",
      },
      {
        text: `The point of contact for this request is ${poc} at ${email} or ${phone}.`,
      },
    ],
    signatureBlock: [
      ph(p.commanderName, "[Commander's Name]"),
      ph(p.commanderRank, "[Rank, Branch]"),
      ph(p.commanderTitle, "Commanding"),
    ],
  };
}

export type EvaluationEntry = {
  height: "99";
  weight: "999";
  comment: string;
  compliance: "YES" | "NO" | "N/A";
};

/**
 * OER/NCOER/AER height/weight/WHtR entry per HQDA EXORD 182-26 Annex B:
 * height "99", weight "999", the WHtR as a comment, and the AR 600-9
 * compliance selection. Pregnant Soldiers get the exemption statement instead.
 */
export function evaluationEntry(opts: {
  whtr: number | null;
  compliant: boolean | null;
  pregnant?: boolean;
}): EvaluationEntry {
  if (opts.pregnant) {
    return {
      height: "99",
      weight: "999",
      comment: "Exempt from waist-to-height ratio standards IAW AR 600 – 9.",
      compliance: "N/A",
    };
  }
  const ratio = opts.whtr !== null ? opts.whtr.toFixed(3) : "0.___";
  return {
    height: "99",
    weight: "999",
    comment: `Waist Height Ratio (WHtR): ${ratio}`,
    compliance: opts.compliant ? "YES" : "NO",
  };
}
