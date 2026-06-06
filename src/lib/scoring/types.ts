export const EVENTS = ["MDL", "HRP", "SDC", "PLK", "2MR"] as const;
export type Event = (typeof EVENTS)[number];

export const BRACKETS = [
  "17-21", "22-26", "27-31", "32-36", "37-41",
  "42-46", "47-51", "52-56", "57-61", "62+",
] as const;
export type Bracket = (typeof BRACKETS)[number];

/**
 * Scoring lane:
 * - "MC" = Males in any role + Combat-MOS sex-neutral (same column in the source table)
 * - "F"  = Female enabling-MOS
 */
export const SEXES = ["MC", "F"] as const;
export type Sex = (typeof SEXES)[number];

export type EventUnit = "lb" | "reps" | "sec";

export type EventRow = readonly [points: number, threshold: number];

export type EventTable = {
  readonly unit: EventUnit;
  readonly higher_is_better: boolean;
  readonly tables: Readonly<Record<Bracket, Readonly<Record<Sex, readonly EventRow[]>>>>;
};

export type ScoringData = {
  readonly source: string;
  readonly effective_date: string;
  readonly brackets: readonly Bracket[];
  readonly sexes: readonly Sex[];
  readonly events: Readonly<Record<Event, EventTable>>;
};

export type RawScores = Readonly<Record<Event, number>>;
export type EventPoints = Readonly<Record<Event, number>>;

export type AftResult = {
  readonly bracket: Bracket;
  readonly sex: Sex;
  readonly events: EventPoints;
  readonly total: number;
  readonly pass: boolean; // 60+ per event
  readonly failedEvents: readonly Event[];
};
