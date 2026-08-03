import type { Event } from "@/lib/scoring/types";
import type {
  AlternateAerobic,
  ExerciseRow,
  Plan,
  ProfileAccommodation,
  SessionPrescription,
  WeekPlan,
} from "./types";

/**
 * Post-generation medical-profile accommodation pass.
 *
 * Takes a fully-generated plan plus the soldier's profile and rewrites the
 * prescription to fit the profile: substitutes low-impact cardio for running,
 * caps loads at a lift limit, swaps out impact/plyometric work, and drops
 * exempt events. Pure and deterministic.
 *
 * When the profile is absent or effectively empty this is a NO-OP and returns
 * the input plan unchanged (same object) — so an un-profiled plan is
 * byte-identical to what `generatePlan` produced before profiles existed.
 */
export function applyAccommodations(
  plan: Plan,
  profile?: ProfileAccommodation,
): Plan {
  if (isNoOp(profile)) return plan;
  const p = profile as ProfileAccommodation;
  const summary: string[] = [];

  let out = plan;
  out = applyAltCardio(out, p, summary);
  out = applyLiftCap(out, p, summary);
  out = applyImpactSwaps(out, p, summary);
  out = applyExemptEvents(out, p, summary);

  return { ...out, accommodations: summary };
}

function isNoOp(p?: ProfileAccommodation): boolean {
  if (!p) return true;
  return (
    p.restrictions.length === 0 &&
    p.exemptEvents.length === 0 &&
    p.alternateAerobic === "none" &&
    p.liftLimitLb === undefined
  );
}

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

/** Map every session in every week/day through `fn`, preserving structure. */
function mapSessions(
  weeks: readonly WeekPlan[],
  fn: (s: SessionPrescription) => SessionPrescription,
): WeekPlan[] {
  return weeks.map((w) => ({
    ...w,
    days: w.days.map((d) => ({ ...d, session: fn(d.session) })),
  }));
}

function appendNote(existing: readonly string[] | undefined, note: string): string[] {
  return existing ? [...existing, note] : [note];
}

/* ------------------------------------------------------------------ */
/* 1. alternate cardio / no-run                                       */
/* ------------------------------------------------------------------ */

const RUN_SESSION_TYPES = new Set(["intervals", "tempo", "long"]);

const MODALITY_NOUN: Record<Exclude<AlternateAerobic, "none">, string> = {
  walk: "brisk walk",
  row: "row erg",
  bike: "stationary bike",
  swim: "swim",
};

/** Which modality to substitute for running, or null if running is allowed. */
function effectiveModality(p: ProfileAccommodation): Exclude<AlternateAerobic, "none"> | null {
  if (p.alternateAerobic !== "none") return p.alternateAerobic;
  if (p.restrictions.includes("no_run")) return "bike"; // default low-impact
  return null;
}

function altCardioSession(
  orig: SessionPrescription,
  modality: Exclude<AlternateAerobic, "none">,
): SessionPrescription {
  const noun = MODALITY_NOUN[modality];
  const cap = noun.charAt(0).toUpperCase() + noun.slice(1);

  let title: string;
  let main: ExerciseRow[];
  if (orig.sessionType === "intervals") {
    title = `${cap} intervals — matched effort`;
    main = [
      {
        name: `8 × 2:00 hard ${noun} / 2:00 easy`,
        sets: 8,
        reps: 1,
        notes: "Hold RPE 9 on the hard reps; easy effort on the recoveries.",
      },
    ];
  } else if (orig.sessionType === "tempo") {
    title = `${cap} tempo — 20 min steady`;
    main = [{ name: `20 min steady ${noun} @ RPE 7`, sets: 1, reps: 1 }];
  } else {
    // long
    title = `Steady ${noun} — 40–50 min easy`;
    main = [
      {
        name: `40–50 min continuous ${noun} @ RPE 5`,
        sets: 1,
        reps: 1,
        notes: "Conversational effort — you should be able to speak in full sentences.",
      },
    ];
  }

  return {
    sessionType: orig.sessionType,
    title,
    ...(orig.rpeTarget !== undefined ? { rpeTarget: orig.rpeTarget } : {}),
    warmup: [`5 min easy ${noun}`, "Dynamic mobility flow"],
    main,
    cooldown: [`5 min easy ${noun}`, "Stretch calves, hips, thoracic"],
    notes: [
      `Profile accommodation: no running — substituted ${noun} at matched effort. Running pace targets don't apply.`,
    ],
  };
}

function applyAltCardio(
  plan: Plan,
  p: ProfileAccommodation,
  summary: string[],
): Plan {
  const modality = effectiveModality(p);
  if (!modality) return plan;

  const weeks = mapSessions(plan.weeks, (s) =>
    RUN_SESSION_TYPES.has(s.sessionType) ? altCardioSession(s, modality) : s,
  );
  summary.push(
    `No running — run sessions replaced with ${MODALITY_NOUN[modality]} at matched effort.`,
  );
  return { ...plan, weeks };
}

/* ------------------------------------------------------------------ */
/* 2. lift cap                                                        */
/* ------------------------------------------------------------------ */

function applyLiftCap(
  plan: Plan,
  p: ProfileAccommodation,
  summary: string[],
): Plan {
  const cap = p.liftLimitLb;
  if (cap === undefined || !(cap > 0)) {
    if (p.restrictions.includes("lift_limit")) {
      summary.push(
        "Lift-limit restriction noted but no weight given — set a limit to cap loads.",
      );
    }
    return plan;
  }

  const clampRow = (row: ExerciseRow): ExerciseRow => {
    if (typeof row.weightLb === "number" && row.weightLb > cap) {
      return {
        ...row,
        weightLb: cap,
        ...(row.weightDescriptor ? { weightDescriptor: `${cap} lb (capped)` } : {}),
      };
    }
    return row;
  };

  const mdlLadder = plan.mdlLadder.map((w) => ({
    ...w,
    sets: w.sets.map((s) => (s.weightLb > cap ? { ...s, weightLb: cap } : s)),
    ...(w.topSingleLb !== undefined && w.topSingleLb > cap
      ? { topSingleLb: cap }
      : {}),
  }));

  const weeks = mapSessions(plan.weeks, (s) => ({
    ...s,
    main: s.main.map(clampRow),
  }));

  summary.push(`Loads capped at ${cap} lb per profile.`);
  return { ...plan, mdlLadder, weeks };
}

/* ------------------------------------------------------------------ */
/* 3. impact / plyometric swaps                                       */
/* ------------------------------------------------------------------ */

const IMPACT_RE = /jump|plyo|box|bound|\bhop|explosive|sprint|depth/i;

function applyImpactSwaps(
  plan: Plan,
  p: ProfileAccommodation,
  summary: string[],
): Plan {
  if (!p.restrictions.includes("no_impact")) return plan;

  let changed = false;
  const weeks = mapSessions(plan.weeks, (s) => {
    const main = s.main.map((row) => {
      if (IMPACT_RE.test(row.name)) {
        changed = true;
        return {
          ...row,
          name: `Low-impact substitute (for ${row.name})`,
          notes: appendNote(
            typeof row.notes === "string" ? [row.notes] : undefined,
            "Profile: no impact — use a low-impact equivalent (step-up, sled push, bike surge).",
          ).join(" "),
        };
      }
      return row;
    });
    return { ...s, main };
  });

  if (changed) {
    summary.push("Impact/plyometric work replaced with low-impact substitutes (no-impact profile).");
  }
  return { ...plan, weeks };
}

/* ------------------------------------------------------------------ */
/* 4. exempt events                                                   */
/* ------------------------------------------------------------------ */

/** Session-row name matchers for each event that has prescribed movements. */
const EVENT_ROW_RE: Partial<Record<Event, RegExp>> = {
  MDL: /deadlift/i,
  HRP: /push-?up|\bhrp\b/i,
  SDC: /\bsdc\b|drag|sprint-drag-carry/i,
  PLK: /plank/i,
  // "2MR" has no strength/skill rows — handled at the top level (gaps/checkpoints) only.
};

function applyExemptEvents(
  plan: Plan,
  p: ProfileAccommodation,
  summary: string[],
): Plan {
  if (p.exemptEvents.length === 0) return plan;
  const exempt = new Set<Event>(p.exemptEvents);

  const gaps = plan.gaps.filter((g) => !exempt.has(g.event));
  const checkpoints = plan.checkpoints
    .map((c) => ({ ...c, events: c.events.filter((e) => !exempt.has(e)) }))
    .filter((c) => c.events.length > 0);

  const mdlLadder = exempt.has("MDL") ? [] : plan.mdlLadder;
  const hrpProgression = exempt.has("HRP") ? [] : plan.hrpProgression;
  const plankProgression = exempt.has("PLK") ? [] : plan.plankProgression;

  const rowMatchers = p.exemptEvents
    .map((e) => EVENT_ROW_RE[e])
    .filter((re): re is RegExp => re !== undefined);

  const weeks =
    rowMatchers.length === 0
      ? plan.weeks
      : mapSessions(plan.weeks, (s) => {
          const main = s.main.filter(
            (row) => !rowMatchers.some((re) => re.test(row.name)),
          );
          const finalMain: readonly ExerciseRow[] =
            main.length > 0
              ? main
              : [
                  {
                    name: "Session events exempt per profile — see accommodations",
                    sets: 1,
                    reps: 1,
                  },
                ];
          return { ...s, main: finalMain };
        });

  for (const e of p.exemptEvents) {
    summary.push(`${e} exempt per profile — removed from targets and sessions.`);
  }

  return {
    ...plan,
    gaps,
    checkpoints,
    mdlLadder,
    hrpProgression,
    plankProgression,
    weeks,
  };
}
