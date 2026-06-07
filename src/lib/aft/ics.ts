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

/**
 * RFC 5545 line folding: first line max 75 octets, continuation lines start
 * with a single space and carry up to 74 octets of content (so total <= 75).
 * Splits by character index, not byte length — fine for ASCII-only content.
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let pos = 75;
  while (pos < line.length) {
    parts.push(" " + line.slice(pos, pos + 74));
    pos += 74;
  }
  return parts.join("\r\n");
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
  strength_a: "AFT Strength A",
  strength_b: "AFT Strength B",
  intervals: "AFT Intervals",
  tempo: "AFT Tempo run",
  long: "AFT Long run",
  aft_skills: "AFT Skills (SDC/HRP/Plank)",
  sdc: "AFT SDC focus",
  recovery: "AFT Recovery",
  rest: "AFT Rest",
};

/**
 * Compact description: just the title and the main exercise lines, one per line.
 * Warmup/cooldown/notes are intentionally omitted from the calendar event so
 * the iCalendar is short enough to download quickly and the calendar UI shows
 * the actionable prescription at a glance. Detail still lives in the web app.
 */
function describeSessionCompact(session: SessionPrescription): string {
  const parts: string[] = [session.title];
  for (const ex of session.main) {
    const weight = ex.weightLb
      ? ` @ ${ex.weightLb} lb`
      : ex.weightDescriptor
        ? ` (${ex.weightDescriptor})`
        : "";
    parts.push(`- ${ex.name}: ${ex.sets}×${ex.reps}${weight}`);
  }
  if (session.rpeTarget !== undefined) {
    parts.push(`RPE ${session.rpeTarget}/10`);
  }
  return parts.join("\n");
}

const SKIPPABLE: ReadonlySet<SessionType> = new Set(["rest", "recovery"]);

export function planToIcs(args: {
  plan: Plan;
  planId: string;
  startDate: Date;
  /** Default true. When true, "rest" AND "recovery" days are omitted. */
  trainingOnly?: boolean;
}): string {
  const { plan, planId, startDate } = args;
  const trainingOnly = args.trainingOnly !== false;
  const week0Monday = snapToMonday(startDate);
  const dtstamp = formatUtcStamp(new Date(plan.generatedAt));

  const out: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PROD_ID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:AFT Plan`,
    `X-WR-CALDESC:Personalized AFT training plan. Goal ${plan.goalTotal} pts by ${plan.input.testDate}.`,
  ];

  for (const week of plan.weeks) {
    for (const day of week.days) {
      const sessionType = day.session.sessionType;
      if (trainingOnly && SKIPPABLE.has(sessionType)) continue;

      const eventDate = new Date(week0Monday);
      eventDate.setUTCDate(
        eventDate.getUTCDate() + week.weekIndex * 7 + day.dayOfWeek,
      );
      const eventNext = new Date(eventDate);
      eventNext.setUTCDate(eventNext.getUTCDate() + 1);

      const summary = `${SESSION_LABEL_FOR_CALENDAR[sessionType]} — W${week.weekIndex + 1}`;
      const description = describeSessionCompact(day.session);
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

  // Test day marker
  const testDay = new Date(plan.input.testDate + "T00:00:00Z");
  if (!Number.isNaN(testDay.getTime())) {
    const testNext = new Date(testDay);
    testNext.setUTCDate(testNext.getUTCDate() + 1);
    const goalSummary = `AFT TEST DAY — goal ${plan.goalTotal} pts`;
    const goalDescription = [
      `Goal totals (bracket ${plan.bracket}):`,
      `MDL ${plan.input.goal.MDL} lb`,
      `HRP ${plan.input.goal.HRP} reps`,
      `SDC ${secToMmss(plan.input.goal.SDC)}`,
      `PLK ${secToMmss(plan.input.goal.PLK)}`,
      `2MR ${secToMmss(plan.input.goal["2MR"])}`,
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
