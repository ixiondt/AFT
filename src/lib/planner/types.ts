import type { Event, RawScores, Sex } from "@/lib/scoring/types";

export type Equipment =
  | "barbell"
  | "rack"
  | "dumbbells"
  | "kettlebell"
  | "sled"
  | "pullup_bar"
  | "track"
  | "treadmill";

export type Injury =
  | "knee"
  | "lower_back"
  | "achilles"
  | "shoulder"
  | "hip"
  | "wrist";

/**
 * Functional restrictions that come off a medical profile (DA Form 3349).
 * Distinct from `Injury` (a training preference that swaps an exercise) — a
 * restriction reshapes what the plan may prescribe at all.
 */
export type RestrictionCode =
  | "no_run"
  | "no_impact"
  | "no_ruck"
  | "no_overhead"
  | "lift_limit"
  | "run_own_pace";

/** Permanent-profile alternate aerobic event; "none" = run as normal. */
export type AlternateAerobic = "none" | "walk" | "row" | "bike" | "swim";

/**
 * Accommodation inputs derived from a soldier's medical profile. Drives the
 * post-generation accommodation pass (see `accommodations.ts`). When absent or
 * empty the pass is a no-op and the plan is byte-identical to the un-profiled one.
 */
export type ProfileAccommodation = {
  restrictions: readonly RestrictionCode[];
  exemptEvents: readonly Event[];
  alternateAerobic: AlternateAerobic;
  /** Hard ceiling (lb) on any prescribed load. Paired with the `lift_limit` restriction. */
  liftLimitLb?: number;
  /** Temp = diagnostic score; permanent = record. Drives profile-aware scoring. */
  profileType?: "temporary" | "permanent";
  /** Go/No-Go of the alternate aerobic event, for scoring the current/baseline test. */
  alternateResult?: "go" | "no_go";
};

export type Preferences = {
  /** Prefer calisthenic accessories (pull-ups, dips, single-leg) over loaded barbell. */
  calisthenicsPreferred: boolean;
  /** Recovery days are active (mobility + walk/bike/swim), never couch rest. */
  activeRecovery: boolean;
};

export type PlanInput = {
  age: number;
  sex: Sex;
  bodyweightLb: number;
  /** Optional target bodyweight (lb) — drives the weight-tracker target line. */
  goalBodyweightLb?: number;
  daysPerWeek: 3 | 4 | 5 | 6;
  durationWeeks: number; // 6..26
  equipment: readonly Equipment[];
  injuries: readonly Injury[];
  preferences: Preferences;
  /** Optional medical-profile accommodations. Absent = no profile. */
  profile?: ProfileAccommodation;
  current: RawScores; // raw values; times in seconds
  goal: RawScores;
  testDate: string; // ISO date
};

export type BlockName = "Base" | "Build" | "Peak" | "Test";

export type Block = {
  name: BlockName;
  weeks: number;
  startWeekIndex: number; // inclusive, 0-based
};

export type PaceZones = {
  vdot: number;
  easyPerMileSec: number;
  marathonPerMileSec: number;
  tempoPerMileSec: number;
  intervalPerMileSec: number;
  repetitionPerMileSec: number;
  pace400Sec: number;
  pace800Sec: number;
  pace1200Sec: number;
  goal2MRPaceSec: number; // per mile pace at goal 2MR
};

export type MdlSet = { reps: number | "AMRAP"; weightLb: number };

export type MdlLadderWeek = {
  weekIndex: number;
  block: BlockName;
  sets: readonly MdlSet[];
  topSingleLb?: number; // optional heavy single during Peak weeks
  notes?: string;
};

export type PlankProgressionWeek = {
  weekIndex: number;
  setsHoldsSec: readonly number[]; // 3 holds typically
  maxAttempt?: number; // Friday max attempt target
};

export type HrpProgressionWeek = {
  weekIndex: number;
  setsReps: readonly { sets: number; reps: number }[]; // typically a single entry
  amrapTarget?: number; // weekly AMRAP target
};

export type SdcSessionPlan =
  | {
      kind: "event";
      mode: "maintain" | "improve";
      targetTimeSec: number;
      effortPct: number; // 0-100
      notes: string;
    }
  | {
      kind: "proxy";
      shuttles: number;
      sprintMeters: number;
      farmerCarryWeightLb: number;
      lateralReps: number;
      notes: string;
    };

export type RunSessionKind = "easy" | "intervals" | "tempo" | "long" | "recovery";

export type ExerciseRow = {
  name: string;
  sets: number;
  reps: number | string;
  weightLb?: number;
  weightDescriptor?: string;
  notes?: string;
};

export type SessionType =
  | "strength_a"
  | "strength_b"
  | "intervals"
  | "tempo"
  | "long"
  | "aft_skills"
  | "sdc"
  | "recovery"
  | "rest";

export type SessionPrescription = {
  sessionType: SessionType;
  title: string;
  rpeTarget?: number;
  warmup: readonly string[];
  main: readonly ExerciseRow[];
  cooldown: readonly string[];
  notes?: readonly string[];
};

export type DayPlan = {
  dayOfWeek: number; // 0=Mon..6=Sun
  session: SessionPrescription;
};

export type WeekPlan = {
  weekIndex: number; // 0-based
  block: BlockName;
  days: readonly DayPlan[];
  weekNotes?: readonly string[];
};

export type Checkpoint = {
  weekIndex: number; // anchor week
  label: string; // e.g., "Day 30 diagnostic"
  fraction: number; // 0..1 of plan duration
  events: readonly Event[]; // which events to test
  targets: Readonly<Partial<RawScores>>; // raw targets for that checkpoint
  retoolIfMissed: readonly string[];
};

export type GapEntry = {
  event: Event;
  currentPoints: number;
  goalPoints: number;
  gap: number;
};

export type PlanNarrative = {
  blockIntros: { Base: string; Build: string; Peak: string; Test: string };
  weeklyThemes: string[];
  exerciseSwaps: {
    deadlift?: string;
    squat?: string;
    push?: string;
    run?: string;
  };
  formCues: { MDL: string; HRP: string; SDC: string; PLK: string; "2MR": string };
  closingNote: string;
};

export type RealismWarningStored = {
  severity: "info" | "warn" | "danger";
  scope: "total" | "event";
  event?: "MDL" | "HRP" | "SDC" | "PLK" | "2MR";
  message: string;
  suggestion?: string;
};

export type Plan = {
  input: PlanInput;
  bracket: string;
  currentTotal: number;
  goalTotal: number;
  gaps: readonly GapEntry[];
  blocks: readonly Block[];
  paces: PaceZones;
  mdlLadder: readonly MdlLadderWeek[];
  plankProgression: readonly PlankProgressionWeek[];
  hrpProgression: readonly HrpProgressionWeek[];
  weeks: readonly WeekPlan[];
  checkpoints: readonly Checkpoint[];
  /** Non-blocking warnings about how aggressive the goals are vs the duration. */
  realism: readonly RealismWarningStored[];
  /**
   * Human-readable summary of medical-profile accommodations applied to this
   * plan (alt cardio, lift caps, exempt events, impact swaps). Absent when no
   * profile applied — drives the accommodations banner on the plan view.
   */
  accommodations?: readonly string[];
  generatedAt: string; // ISO timestamp injected by caller
  narrative?: PlanNarrative;
};
