import scoringJson from "@data/aft_scoring.json" with { type: "json" };
import {
  type AftResult,
  type Bracket,
  type Event,
  type EventPoints,
  type RawScores,
  type ScoringData,
  type Sex,
  EVENTS,
} from "./types";

const DATA = scoringJson as unknown as ScoringData;

/** Convert "m:ss" → seconds. Throws on malformed input. */
export function mmssToSec(input: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(input.trim());
  if (!m) throw new Error(`Invalid m:ss value: ${JSON.stringify(input)}`);
  const min = Number(m[1]);
  const sec = Number(m[2]);
  if (sec >= 60) throw new Error(`Seconds must be < 60: ${input}`);
  return min * 60 + sec;
}

/** Convert seconds → "m:ss" for display. */
export function secToMmss(total: number): string {
  if (!Number.isFinite(total) || total < 0) return "--:--";
  const t = Math.round(total);
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Map a US-Army age in years to its AFT scoring bracket. */
export function ageToBracket(age: number): Bracket {
  if (!Number.isInteger(age) || age < 17) {
    throw new Error(`Age must be an integer >= 17, got ${age}`);
  }
  if (age <= 21) return "17-21";
  if (age <= 26) return "22-26";
  if (age <= 31) return "27-31";
  if (age <= 36) return "32-36";
  if (age <= 41) return "37-41";
  if (age <= 46) return "42-46";
  if (age <= 51) return "47-51";
  if (age <= 56) return "52-56";
  if (age <= 61) return "57-61";
  return "62+";
}

/**
 * Score a single event's raw value against the official table for a given bracket and sex.
 * Returns 0 when the raw value falls below the lowest scored threshold.
 *
 * Tables are sorted points-descending. We walk top→bottom and return the first row whose
 * threshold the raw value meets (>= for higher-is-better events, <= for time events).
 */
export function scoreEvent(
  event: Event,
  bracket: Bracket,
  sex: Sex,
  raw: number,
): number {
  const eventDef = DATA.events[event];
  const table = eventDef.tables[bracket][sex];
  const higherIsBetter = eventDef.higher_is_better;

  for (const row of table) {
    const [points, threshold] = row;
    if (higherIsBetter ? raw >= threshold : raw <= threshold) {
      return points;
    }
  }
  return 0;
}

export type ScoreInput = {
  age: number;
  sex: Sex;
  raw: RawScores;
};

/** Score a full 5-event AFT performance. */
export function scoreAft(input: ScoreInput): AftResult {
  const bracket = ageToBracket(input.age);
  const events: Record<Event, number> = {
    MDL: scoreEvent("MDL", bracket, input.sex, input.raw.MDL),
    HRP: scoreEvent("HRP", bracket, input.sex, input.raw.HRP),
    SDC: scoreEvent("SDC", bracket, input.sex, input.raw.SDC),
    PLK: scoreEvent("PLK", bracket, input.sex, input.raw.PLK),
    "2MR": scoreEvent("2MR", bracket, input.sex, input.raw["2MR"]),
  };

  const total = EVENTS.reduce((acc, ev) => acc + events[ev], 0);
  const failedEvents = EVENTS.filter((ev) => events[ev] < 60);
  return {
    bracket,
    sex: input.sex,
    events: events as EventPoints,
    total,
    pass: failedEvents.length === 0,
    failedEvents,
  };
}

/**
 * Compute the gap (in points) for each event vs a target.
 * Returned events are sorted by largest positive gap first (biggest opportunity to gain).
 */
export type GapEntry = {
  event: Event;
  currentPoints: number;
  goalPoints: number;
  gap: number; // positive = need to improve
};

export function pointGapByEvent(
  current: EventPoints,
  goal: EventPoints,
): GapEntry[] {
  const entries: GapEntry[] = EVENTS.map((ev) => ({
    event: ev,
    currentPoints: current[ev],
    goalPoints: goal[ev],
    gap: goal[ev] - current[ev],
  }));
  // Largest positive gap first; events already maxed (gap <= 0) at the end.
  entries.sort((a, b) => b.gap - a.gap);
  return entries;
}

/** Re-export the loaded data for callers that need to render raw thresholds (e.g. forms). */
export const SCORING_DATA: ScoringData = DATA;

/**
 * Reverse lookup: given a target points value, return the raw threshold that
 * achieves *at least* those points. Useful when a user wants to enter "100 pts"
 * for MDL and we need to convert that into the actual lb requirement.
 *
 * The scoring table is sparse (some point values are "---" gaps), so we
 * floor-snap to the highest row whose points >= the request.
 */
export function rawFromPoints(
  event: Event,
  bracket: Bracket,
  sex: Sex,
  targetPoints: number,
): number | null {
  if (!Number.isFinite(targetPoints) || targetPoints < 0 || targetPoints > 100) {
    return null;
  }
  const eventDef = DATA.events[event];
  const table = eventDef.tables[bracket][sex];
  // table is sorted points DESC; find the first row with points >= target.
  for (const row of table) {
    const [points, threshold] = row;
    if (points >= targetPoints) {
      // Keep walking — we want the LAST row that still meets the target,
      // since that's the *easiest* raw value that achieves it.
      // (rows are descending in points; threshold for higher-is-better is also
      // descending, and for lower-is-better is ascending. The raw value that
      // achieves `targetPoints` is at the row whose points is exactly targetPoints
      // OR the next higher available.)
      let last: readonly [number, number] = [points, threshold];
      for (const r of table) {
        if (r[0] >= targetPoints) last = r;
        else break;
      }
      return last[1];
    }
  }
  // Target is higher than the max scored point — return the max threshold.
  const top = table[0];
  return top ? top[1] : null;
}
