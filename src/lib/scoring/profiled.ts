import { ageToBracket, scoreEvent } from "./index";
import { EVENTS, type Bracket, type Event, type RawScores, type Sex } from "./types";

export type AlternateModality = "walk" | "row" | "bike" | "swim";
export type GoNoGo = "go" | "no_go";

/**
 * The profile facts that change how an AFT is scored. Distinct from the training
 * accommodation shape — this drives the *score sheet*, not the plan.
 */
export type ProfileScoringSpec = {
  profileType: "temporary" | "permanent";
  /** Events the profile exempts (not performed, excluded from the total). */
  exemptEvents: readonly Event[];
  /** Permanent-profile alternate aerobic event; "none" = run the 2-mile normally. */
  alternateAerobic: "none" | AlternateModality;
  /** Go/No-Go result of the alternate aerobic event. Undefined = not yet recorded. */
  alternateResult?: GoNoGo;
};

export type ProfiledAftResult = {
  /** Permanent profile → a scorable record; temporary → diagnostic only. */
  isRecord: boolean;
  status: "record" | "diagnostic";
  bracket: Bracket;
  sex: Sex;
  /** Points for each scored event (exempt events omitted; 2MR omitted when an alternate is used). */
  events: Partial<Record<Event, number>>;
  exemptEvents: readonly Event[];
  /** The alternate aerobic result, when one applies. Go = 60, No-Go = 0. */
  alternate?: { modality: AlternateModality; result: GoNoGo; points: number };
  /** Sum of scored event points (+ alternate). Note: NOT out of 500 when events are exempt. */
  total: number;
  /** How many events (incl. alternate) contributed to the total. */
  scoredEventCount: number;
  /** Scored events below 60. */
  failedEvents: readonly Event[];
  /** True when every scored event ≥ 60 and the alternate (if any) is a Go. */
  pass: boolean;
};

/**
 * Score an AFT under a medical profile ("full doctrinal"):
 * - Exempt events are excluded from the total (not scored as 0).
 * - A permanent-profile alternate aerobic event replaces the 2-mile run and is
 *   scored Go/No-Go: Go = 60 pts, No-Go = 0. (No time standards are hardcoded —
 *   the Go/No-Go is an entered result.)
 * - A temporary profile yields a diagnostic result, never a record score.
 *
 * Pure and deterministic.
 */
export function scoreAftProfiled(args: {
  age: number;
  sex: Sex;
  raw: RawScores;
  profile: ProfileScoringSpec;
}): ProfiledAftResult {
  const { age, sex, raw, profile } = args;
  const bracket = ageToBracket(age);
  const exempt = new Set<Event>(profile.exemptEvents);
  const altActive = profile.alternateAerobic !== "none";

  const events: Partial<Record<Event, number>> = {};
  const failedEvents: Event[] = [];
  let total = 0;

  for (const ev of EVENTS) {
    if (exempt.has(ev)) continue;
    if (ev === "2MR" && altActive) continue; // replaced by the alternate event
    const pts = scoreEvent(ev, bracket, sex, raw[ev]);
    events[ev] = pts;
    total += pts;
    if (pts < 60) failedEvents.push(ev);
  }

  let alternate: ProfiledAftResult["alternate"];
  let altPassed = true;
  if (altActive) {
    const result: GoNoGo = profile.alternateResult ?? "no_go";
    const points = result === "go" ? 60 : 0;
    alternate = { modality: profile.alternateAerobic as AlternateModality, result, points };
    total += points;
    altPassed = result === "go";
  }

  const isRecord = profile.profileType === "permanent";
  const scoredEventCount = Object.keys(events).length + (altActive ? 1 : 0);
  const pass = failedEvents.length === 0 && altPassed;

  return {
    isRecord,
    status: isRecord ? "record" : "diagnostic",
    bracket,
    sex,
    events,
    exemptEvents: [...exempt],
    ...(alternate ? { alternate } : {}),
    total,
    scoredEventCount,
    failedEvents,
    pass,
  };
}
