import { computePaceZones } from "@/lib/planner/pace";
import { secToMmss } from "@/lib/scoring";
import type { ProfileAccommodation } from "@/lib/planner/types";
import type {
  AtAbilityGroup,
  AtAbilityGroupKey,
  AtDayPlan,
  AtMemberInput,
  AtPlan,
  AtPlanInput,
  AtSessionFocus,
  AtSoldierCard,
} from "./types";

export * from "./types";

const MODALITY_NOUN: Record<"walk" | "row" | "bike" | "swim", string> = {
  walk: "2.5-mi walk",
  row: "5,000 m row",
  bike: "12 km bike",
  swim: "1,000 m swim",
};

function round5(n: number): number {
  return Math.round(n / 5) * 5;
}

/** Does this member run for the group, or go in the alternate-cardio group? */
function altModalityFor(
  p: ProfileAccommodation | undefined,
): "walk" | "row" | "bike" | "swim" | null {
  if (!p) return null;
  if (p.alternateAerobic !== "none") return p.alternateAerobic;
  if (p.restrictions.includes("no_run")) return "bike";
  return null;
}

/** Human-readable accommodation lines for a member's card. */
function describeAccommodations(p: ProfileAccommodation | undefined): string[] {
  if (!p) return [];
  const out: string[] = [];
  const modality = altModalityFor(p);
  if (modality) out.push(`Alternate aerobic: ${MODALITY_NOUN[modality]} (no running).`);
  if (p.liftLimitLb !== undefined && p.liftLimitLb > 0) {
    out.push(`Lifting capped at ${p.liftLimitLb} lb.`);
  } else if (p.restrictions.includes("lift_limit")) {
    out.push("Lift-limit noted (no weight set).");
  }
  if (p.restrictions.includes("no_impact")) out.push("No impact/plyometrics.");
  if (p.restrictions.includes("no_ruck")) out.push("No ruck/road march.");
  if (p.restrictions.includes("no_overhead")) out.push("No overhead lifting.");
  if (p.exemptEvents.length) out.push(`Exempt: ${p.exemptEvents.join(", ")}.`);
  return out;
}

/** Ability band from a 2-mile time (seconds). */
function bandFor2MR(sec: number): "A" | "B" | "C" {
  if (sec <= 14 * 60) return "A";
  if (sec <= 17 * 60) return "B";
  return "C";
}

/** Easy per-mile pace (sec) from a 2-mile time, reusing the VDOT pace model. */
function easyPaceFrom2MR(sec: number): number {
  return computePaceZones(sec, sec).easyPerMileSec;
}

const GROUP_META: Record<AtAbilityGroupKey, { label: string; description: string }> = {
  A: { label: "Group A", description: "Faster runners (2-mile ≤ 14:00)" },
  B: { label: "Group B", description: "Mid pace (2-mile 14:00–17:00)" },
  C: { label: "Group C", description: "Developing runners (2-mile > 17:00)" },
  ALT: { label: "Alt group", description: "Profiled — alternate aerobic event" },
  UNASSESSED: { label: "Unassessed", description: "No baseline run on file" },
};

type Assignment = { member: AtMemberInput; key: AtAbilityGroupKey };

function assignGroups(members: readonly AtMemberInput[]): Assignment[] {
  return members.map((member) => {
    if (altModalityFor(member.profile)) return { member, key: "ALT" as const };
    if (member.twoMileSec == null) return { member, key: "UNASSESSED" as const };
    return { member, key: bandFor2MR(member.twoMileSec) };
  });
}

function buildGroups(assignments: Assignment[]): AtAbilityGroup[] {
  const order: AtAbilityGroupKey[] = ["A", "B", "C", "ALT", "UNASSESSED"];
  const groups: AtAbilityGroup[] = [];

  for (const key of order) {
    const members = assignments.filter((a) => a.key === key).map((a) => a.member);
    if (members.length === 0) continue;

    const base: AtAbilityGroup = {
      key,
      label: GROUP_META[key].label,
      description: GROUP_META[key].description,
      memberIds: members.map((m) => m.id),
    };

    if (key === "A" || key === "B" || key === "C") {
      // Pace the group so the slowest can hold it: use the group's slowest easy pace.
      const paces = members
        .filter((m) => m.twoMileSec != null)
        .map((m) => easyPaceFrom2MR(m.twoMileSec as number));
      const slowest = paces.length ? Math.max(...paces) : undefined;
      groups.push({ ...base, ...(slowest !== undefined ? { prescribedPacePerMileSec: slowest } : {}) });
    } else if (key === "ALT") {
      // Most common modality in the group (default bike).
      const counts = new Map<"walk" | "row" | "bike" | "swim", number>();
      for (const m of members) {
        const mod = altModalityFor(m.profile);
        if (mod) counts.set(mod, (counts.get(mod) ?? 0) + 1);
      }
      let modality: "walk" | "row" | "bike" | "swim" = "bike";
      let best = 0;
      for (const [mod, c] of counts) if (c > best) { best = c; modality = mod; }
      groups.push({ ...base, modality });
    } else {
      groups.push(base);
    }
  }
  return groups;
}

/* --------------------------- daily schedule --------------------------- */

const PREP = [
  "Preparation Drill (PRT): bend-and-reach, rear lunge, high jumper, rower,",
  "  squat bender, windmill, forward lunge, prone row, bent-leg body twist, push-up",
  "5 min easy movement to raise core temp",
];
const RECOVERY = [
  "Recovery Drill (PRT): overhead arm pull, rear lunge, extend-and-flex,",
  "  thigh stretch, single-leg over",
  "Hydrate; reinforce next session's report time",
];

/** Rotating focus for successive PT days (rest days excluded). */
const FOCUS_CYCLE: AtSessionFocus[] = [
  "endurance",
  "strength",
  "intervals",
  "events",
  "endurance",
  "recovery",
];

function runGroupLines(groups: readonly AtAbilityGroup[], intervals: boolean): string[] {
  const lines: string[] = [];
  for (const g of groups) {
    if (g.key === "A" || g.key === "B" || g.key === "C") {
      const pace = g.prescribedPacePerMileSec
        ? `${secToMmss(g.prescribedPacePerMileSec)}/mi`
        : "assigned pace";
      lines.push(
        intervals
          ? `${g.label}: 6 × 400 m near race pace, 90 s jog recovery (lead pace ${pace})`
          : `${g.label}: ability-group run 20–30 min @ ${pace}`,
      );
    } else if (g.key === "ALT") {
      lines.push(`${g.label}: ${MODALITY_NOUN[g.modality ?? "bike"]} at matched effort`);
    } else {
      lines.push(`${g.label}: run a 1-mile assessment to place into an ability group`);
    }
  }
  return lines;
}

function buildDay(args: {
  dayIndex: number;
  dateISO: string;
  dayOfWeek: number;
  groups: readonly AtAbilityGroup[];
  ptDayIndex: number;
}): AtDayPlan {
  const { dayIndex, dateISO, dayOfWeek, groups, ptDayIndex } = args;

  // Rest on Sundays (dayOfWeek 6).
  if (dayOfWeek === 6) {
    return {
      dayIndex,
      dateISO,
      dayOfWeek,
      rest: true,
      title: "Rest / recovery day",
      preparation: [],
      activities: ["Rest. Hydrate, mobility, and sleep. Walk if desired."],
      recovery: [],
    };
  }

  const focus = FOCUS_CYCLE[ptDayIndex % FOCUS_CYCLE.length]!;
  let title: string;
  let activities: string[];

  switch (focus) {
    case "endurance":
      title = "Endurance — Ability Group Run";
      activities = ["Ability Group Runs (AGR):", ...runGroupLines(groups, false)];
      break;
    case "intervals":
      title = "Speed — interval work";
      activities = ["Interval session by ability group:", ...runGroupLines(groups, true)];
      break;
    case "strength":
      title = "Strength — muscular endurance circuit";
      activities = [
        "Circuit ×3 (scale load per soldier card):",
        "  Deadlift/hinge · Hand-release push-up · Plank · Kettlebell swing · Sandbag carry",
        "MDL practice: build to a moderate 3-rep set",
      ];
      break;
    case "events":
      title = "AFT events practice";
      activities = [
        "Sprint-Drag-Carry: 2 full rehearsals at controlled effort",
        "Hand-release push-up: 3 sets technique + 1 AMRAP",
        "Plank: 3 holds progressing toward standard",
      ];
      break;
    case "recovery":
    default:
      title = "Active recovery + mobility";
      activities = [
        "30–40 min easy aerobic (walk/bike/row/swim) at conversational effort",
        "Mobility + foam roll; address minor niggles before they grow",
      ];
      break;
  }

  return {
    dayIndex,
    dateISO,
    dayOfWeek,
    rest: false,
    focus,
    title,
    preparation: PREP,
    activities,
    recovery: RECOVERY,
  };
}

/* ----------------------------- soldier cards ----------------------------- */

function runPrescriptionFor(member: AtMemberInput, key: AtAbilityGroupKey, group?: AtAbilityGroup): string {
  if (key === "ALT") {
    const mod = altModalityFor(member.profile) ?? "bike";
    return `Alternate aerobic — ${MODALITY_NOUN[mod]} (no running)`;
  }
  if (key === "UNASSESSED") return "Run a 1-mile assessment to set your pace";
  const pace = group?.prescribedPacePerMileSec
    ? `${secToMmss(group.prescribedPacePerMileSec)}/mi`
    : member.twoMileSec != null
      ? `${secToMmss(easyPaceFrom2MR(member.twoMileSec))}/mi`
      : "assigned pace";
  return `${group?.label ?? key} — easy runs @ ${pace}`;
}

function strengthPrescriptionFor(member: AtMemberInput): string {
  const p = member.profile;
  if (p?.exemptEvents.includes("MDL")) return "MDL exempt per profile — skip deadlift work";
  const cap = p?.liftLimitLb;
  if (member.mdlLb == null) {
    const base = "Self-select a moderate load (RPE 7); progress weekly";
    return cap ? `${base}; cap ${cap} lb` : base;
  }
  let working = round5(member.mdlLb * 0.6);
  let capped = false;
  if (cap !== undefined && cap > 0 && working > cap) {
    working = cap;
    capped = true;
  }
  return `Deadlift 5×5 @ ~${working} lb${capped ? " (capped per profile)" : ""}`;
}

function buildCard(member: AtMemberInput, key: AtAbilityGroupKey, group?: AtAbilityGroup): AtSoldierCard {
  const accommodations = describeAccommodations(member.profile);
  const notes: string[] = [];
  if (member.twoMileSec == null && key !== "ALT") {
    notes.push("Needs a baseline run to refine pace.");
  }
  return {
    memberId: member.id,
    displayName: member.displayName,
    abilityGroup: key,
    runPrescription: runPrescriptionFor(member, key, group),
    strengthPrescription: strengthPrescriptionFor(member),
    accommodations,
    notes,
  };
}

/* ------------------------------- generator ------------------------------- */

export function generateAtPlan(input: AtPlanInput, now: Date = new Date()): AtPlan {
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > 21) {
    throw new Error(`AT days must be an integer in [1, 21], got ${input.days}`);
  }

  const assignments = assignGroups(input.members);
  const groups = buildGroups(assignments);
  const groupByKey = new Map(groups.map((g) => [g.key, g]));

  // Daily schedule across the AT window.
  const start = new Date(`${input.startDateISO}T00:00:00Z`);
  const schedule: AtDayPlan[] = [];
  let ptDayIndex = 0;
  for (let d = 0; d < input.days; d++) {
    const date = new Date(start.getTime() + d * 86_400_000);
    const dateISO = date.toISOString().slice(0, 10);
    const dayOfWeek = (date.getUTCDay() + 6) % 7; // 0=Mon..6=Sun
    const day = buildDay({ dayIndex: d, dateISO, dayOfWeek, groups, ptDayIndex });
    if (!day.rest) ptDayIndex++;
    schedule.push(day);
  }

  const cards = assignments.map((a) => buildCard(a.member, a.key, groupByKey.get(a.key)));

  const warnings: string[] = [];
  const unassessed = assignments.filter((a) => a.key === "UNASSESSED").length;
  if (unassessed > 0) {
    warnings.push(
      `${unassessed} soldier${unassessed === 1 ? "" : "s"} have no baseline run — run a 1-mile assessment on day 1 to place them into ability groups.`,
    );
  }
  if (input.members.length === 0) warnings.push("No soldiers on the roster yet.");

  return {
    unitName: input.unitName,
    startDateISO: input.startDateISO,
    days: input.days,
    generatedAt: now.toISOString(),
    groups,
    schedule,
    cards,
    warnings,
  };
}
