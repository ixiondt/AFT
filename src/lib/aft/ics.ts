import { secToMmss } from "@/lib/scoring";
import type { Plan, SessionPrescription, SessionType } from "@/lib/planner";

const PROD_ID = "-//AFT Planner//EN";

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatUtcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
  );
}

function formatDateOnly(d: Date): string {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** RFC 5545 line folding: 75 octets/line, continuation lines start with a single space. */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    const chunk = line.slice(i, i + (i === 0 ? 75 : 74));
    out.push(i === 0 ? chunk : ` ${chunk}`);
    i += chunk.length - (i === 0 ? 0 : 1);
  }
  return out.join("\r\n");
}

/** Snap a date forward to the next Monday (if not already Monday). */
function snapToMonday(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  let offset: number;
  if (day === 1) offset = 0;
  else if (day === 0) offset = 1;
  else offset = 8 - day;
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

const SESSION_LABEL_FOR_CALENDAR: Record<SessionType, string> = {
  strength_a: "AFT • Strength A",
  strength_b: "AFT • Strength B",
  intervals: "AFT • Run intervals",
  tempo: "AFT • Tempo run",
  long: "AFT • Long run",
  aft_skills: "AFT • Skills (SDC/HRP/Plank)",
  sdc: "AFT • SDC focus",
  recovery: "AFT • Active recovery",
  rest: "AFT • Rest",
};

function describeSession(session: SessionPrescription): string {
  const lines: string[] = [];
  if (session.warmup.length) {
    lines.push("Warm-up:");
    for (const w of session.warmup) lines.push(`• ${w}`);
    lines.push("");
  }
  if (session.main.length) {
    lines.push("Main:");
    for (const ex of session.main) {
      const weight = ex.weightLb
        ? ` @ ${ex.weightLb} lb`
        : ex.weightDescriptor
          ? ` (${ex.weightDescriptor})`
          : "";
      const exLine = `• ${ex.name}: ${ex.sets}×${ex.reps}${weight}`;
      lines.push(exLine);
      if (ex.notes) lines.push(`  ${ex.notes}`);
    }
    lines.push("");
  }
  if (session.cooldown.length) {
    lines.push("Cool-down:");
    for (const c of session.cooldown) lines.push(`• ${c}`);
  }
  if (session.notes && session.notes.length) {
    lines.push("");
    lines.push("Notes:");
    for (const n of session.notes) lines.push(`• ${n}`);
  }
  if (session.rpeTarget !== undefined) {
    lines.push("");
    lines.push(`RPE target: ${session.rpeTarget}/10`);
  }
  return lines.join("\n");
}

export function planToIcs(args: {
  plan: Plan;
  planId: string;
  startDate: Date;
  /** If true, skip scheduling "rest" days as events. Default true. */
  skipRest?: boolean;
}): string {
  const { plan, planId, startDate } = args;
  const skipRest = args.skipRest !== false;
  const week0Monday = snapToMonday(startDate);
  const dtstamp = formatUtcStamp(new Date(plan.generatedAt));

  const out: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PROD_ID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:AFT Plan (${plan.input.durationWeeks} wk)`,
    `X-WR-CALDESC:Personalized AFT training plan. Goal ${plan.goalTotal} pts by ${plan.input.testDate}.`,
  ];

  for (const week of plan.weeks) {
    for (const day of week.days) {
      const sessionType = day.session.sessionType;
      if (skipRest && sessionType === "rest") continue;

      const eventDate = new Date(week0Monday);
      eventDate.setUTCDate(
        eventDate.getUTCDate() + week.weekIndex * 7 + day.dayOfWeek,
      );
      const eventNext = new Date(eventDate);
      eventNext.setUTCDate(eventNext.getUTCDate() + 1);

      const summary = `${SESSION_LABEL_FOR_CALENDAR[sessionType]} — W${week.weekIndex + 1} ${week.block}`;
      const description = describeSession(day.session);
      const uid = `plan-${planId}-w${week.weekIndex}-d${day.dayOfWeek}@aft-planner`;

      out.push(
        "BEGIN:VEVENT",
        foldLine(`UID:${uid}`),
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${formatDateOnly(eventDate)}`,
        `DTEND;VALUE=DATE:${formatDateOnly(eventNext)}`,
        foldLine(`SUMMARY:${escapeText(summary)}`),
        foldLine(`DESCRIPTION:${escapeText(description)}`),
        "TRANSP:TRANSPARENT",
        "END:VEVENT",
      );
    }
  }

  // Add the test day itself as a marker event on testDate.
  const testDay = new Date(plan.input.testDate + "T00:00:00Z");
  if (!Number.isNaN(testDay.getTime())) {
    const testNext = new Date(testDay);
    testNext.setUTCDate(testNext.getUTCDate() + 1);
    const goalSummary = `AFT • TEST DAY — goal ${plan.goalTotal} pts`;
    const goalDescription = [
      `Bracket: ${plan.bracket}`,
      `Goal total: ${plan.goalTotal} pts`,
      "",
      "Targets:",
      `• MDL: ${plan.input.goal.MDL} lb`,
      `• HRP: ${plan.input.goal.HRP} reps`,
      `• SDC: ${secToMmss(plan.input.goal.SDC)}`,
      `• PLK: ${secToMmss(plan.input.goal.PLK)}`,
      `• 2MR: ${secToMmss(plan.input.goal["2MR"])}`,
    ].join("\n");
    out.push(
      "BEGIN:VEVENT",
      foldLine(`UID:plan-${planId}-testday@aft-planner`),
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${formatDateOnly(testDay)}`,
      `DTEND;VALUE=DATE:${formatDateOnly(testNext)}`,
      foldLine(`SUMMARY:${escapeText(goalSummary)}`),
      foldLine(`DESCRIPTION:${escapeText(goalDescription)}`),
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }

  out.push("END:VCALENDAR");
  return out.join("\r\n") + "\r\n";
}
