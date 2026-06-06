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
  daysPerWeek: 3 | 4 | 5 | 6;
  durationWeeks: number; // 6..26
  equipment: readonly Equipment[];
  injuries: readonly Injury[];
  preferences: Preferences;
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
  generatedAt: string; // ISO timestamp injected by caller
  narrative?: PlanNarrative;
};
