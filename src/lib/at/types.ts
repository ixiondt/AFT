import type { RawScores, Sex } from "@/lib/scoring/types";
import type { ProfileAccommodation } from "@/lib/planner/types";

export type AtAbilityGroupKey = "A" | "B" | "C" | "ALT" | "UNASSESSED";

export type AtAbilityGroup = {
  key: AtAbilityGroupKey;
  label: string;
  description: string;
  /** Prescribed run pace (sec/mile) for run groups A/B/C. */
  prescribedPacePerMileSec?: number;
  /** Substitute modality for the ALT (profiled) group. */
  modality?: "walk" | "row" | "bike" | "swim";
  memberIds: readonly string[];
};

export type AtSessionFocus =
  | "endurance"
  | "intervals"
  | "strength"
  | "events"
  | "recovery";

export type AtDayPlan = {
  dayIndex: number; // 0-based within the AT window
  dateISO: string; // YYYY-MM-DD
  dayOfWeek: number; // 0=Mon..6=Sun
  rest: boolean;
  focus?: AtSessionFocus;
  title: string;
  preparation: readonly string[];
  activities: readonly string[];
  recovery: readonly string[];
};

export type AtSoldierCard = {
  memberId: string;
  displayName: string;
  abilityGroup: AtAbilityGroupKey;
  runPrescription: string;
  strengthPrescription: string;
  accommodations: readonly string[];
  notes: readonly string[];
  /** Baseline AFT score (profile-aware) when a full baseline is on file. */
  aftScore?: {
    total: number;
    scoredEventCount: number;
    isRecord: boolean;
    pass: boolean;
    profiled: boolean;
  };
};

export type AtMemberInput = {
  id: string;
  displayName: string;
  age: number | null;
  sex: Sex | null;
  /** Full baseline (all 5 raw events) when known — enables scoring/scaling. */
  baseline: RawScores | null;
  /** 2-mile time in seconds; null when unassessed. */
  twoMileSec: number | null;
  /** Baseline MDL 3RM (lb) for strength scaling; null when unknown. */
  mdlLb: number | null;
  profile?: ProfileAccommodation;
};

export type AtPlanInput = {
  unitName: string;
  startDateISO: string; // YYYY-MM-DD
  days: number; // AT length in days (1..21)
  members: readonly AtMemberInput[];
};

export type AtPlan = {
  unitName: string;
  startDateISO: string;
  days: number;
  generatedAt: string;
  groups: readonly AtAbilityGroup[];
  schedule: readonly AtDayPlan[];
  cards: readonly AtSoldierCard[];
  /** Non-blocking notes for the MFT (e.g., soldiers needing a baseline run). */
  warnings: readonly string[];
};
