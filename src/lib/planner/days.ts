import { blockForWeek } from "./periodization";
import { catalogItemAsExerciseRow, pickFromCatalog } from "./catalog";
import { hasSdcGear, makeSdcSession } from "./sdc";
import type {
  Block,
  DayPlan,
  Equipment,
  ExerciseRow,
  HrpProgressionWeek,
  Injury,
  MdlLadderWeek,
  PaceZones,
  PlankProgressionWeek,
  PlanInput,
  Preferences,
  SessionPrescription,
  SessionType,
} from "./types";
import { secToMmss } from "@/lib/scoring";
import { squatPrescription } from "./strength";

/* ----------------------------- session ordering ----------------------------- */

const SESSION_PRIORITY: readonly SessionType[] = [
  "intervals",
  "long",
  "strength_a",
  "tempo",
  "strength_b",
  "aft_skills",
  "recovery",
];

/** Pick which session types fit a given days-per-week count, in priority order. */
function pickSessionTypes(daysPerWeek: PlanInput["daysPerWeek"]): readonly SessionType[] {
  return SESSION_PRIORITY.slice(0, daysPerWeek);
}

/**
 * Assign session types to days of the week (0 = Mon). Six-day arrangement:
 *   Mon Strength A | Tue Intervals | Wed AFT Skills | Thu Tempo | Fri Strength B | Sat Long | Sun Recovery
 *
 * For fewer days, we spread the picked sessions across the week with hard-day separation,
 * then fill remaining slots with "rest" (or "recovery" if user prefers active recovery).
 */
export function assignSessionDays(
  daysPerWeek: PlanInput["daysPerWeek"],
  preferences: Preferences,
): readonly SessionType[] {
  const picks = new Set(pickSessionTypes(daysPerWeek));
  const restType: SessionType = preferences.activeRecovery ? "recovery" : "rest";

  const six: SessionType[] = [
    "strength_a",
    "intervals",
    "aft_skills",
    "tempo",
    "strength_b",
    "long",
    "recovery",
  ];
  // Drop any session-types not in picks; collapse to remaining days using restType.
  const slotted = six.map((s) =>
    s === "recovery" ? (picks.has("recovery") ? "recovery" : restType) : (picks.has(s) ? s : restType),
  );

  // Make sure two hard run/strength days never sit back to back if user gave us slack.
  return slotted;
}

/* ----------------------------- prescription builders ----------------------------- */

function injurySwap(name: string, injuries: readonly Injury[]): string {
  if (injuries.includes("lower_back") && /deadlift/i.test(name))
    return `${name} (sub: trap-bar deadlift, neutral spine focus)`;
  if (injuries.includes("knee") && /squat|lunge/i.test(name))
    return `${name} (sub: split squat, knee-tracking-over-toe pause)`;
  if (injuries.includes("achilles") && /interval|sprint/i.test(name))
    return `${name} (sub: bike intervals at matched RPE)`;
  if (injuries.includes("shoulder") && /push|press|hrp/i.test(name))
    return `${name} (sub: elevated push-up, full ROM, slow eccentric)`;
  return name;
}

const MOBILITY_BLOCK = [
  "World's greatest stretch, 5/side",
  "90/90 hip switches, 8 reps",
  "Wall t-spine rotation, 8/side",
  "Cat/cow, 10 reps",
  "Banded shoulder pass-through, 10 reps",
];

const ACTIVE_RECOVERY = [
  "20–30 min easy walk, bike, swim, or row at conversational effort",
  "Mobility flow (above) once through",
  "Foam roll: calves, quads, glutes, lats — 60s each",
];

const SDC_PROXY_NOTE = (shuttles: number, sprintM: number, kbWt: number) =>
  `Proxy SDC: ${shuttles} shuttles of [${sprintM}m sprint → 25m bear crawl → ${sprintM}m sprint with ${kbWt} lb in each hand → 25m lateral shuffle → ${sprintM}m sprint]. Rest 90s between shuttles.`;

function build_strength_a(args: {
  ladder: MdlLadderWeek;
  weekIndex: number;
  preferences: Preferences;
  injuries: readonly Injury[];
  equipment: readonly Equipment[];
}): SessionPrescription {
  const { ladder, weekIndex, preferences, injuries, equipment } = args;
  const sets = ladder.sets.map<ExerciseRow>((s, i) => ({
    name: i === 0 ? injurySwap("Deadlift (conventional)", injuries) : "Deadlift",
    sets: 1,
    reps: s.reps,
    weightLb: s.weightLb,
    weightDescriptor: `${s.weightLb} lb`,
  }));

  const ctx = { equipment, injuries, calisthenicsPreferred: preferences.calisthenicsPreferred };
  const accessories: ExerciseRow[] = [
    pickFromCatalog("accessory_pull", ctx, weekIndex),
    pickFromCatalog("accessory_hinge", ctx, weekIndex + 1),
    pickFromCatalog("accessory_core", ctx, weekIndex + 2),
  ]
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .map((x) => catalogItemAsExerciseRow(x));

  return {
    sessionType: "strength_a",
    title: "Strength A — Deadlift focus",
    rpeTarget: 8,
    warmup: [
      "5 min easy bike or row",
      "Mobility block: hips, thoracic, ankles (5 min)",
      "Empty bar deadlift × 8, then 50% MDL × 5, 65% MDL × 3",
    ],
    main: [...sets, ...accessories],
    cooldown: ["5 min walk", "Couch stretch 60s/side", "Foam roll glutes/erectors"],
    ...(ladder.notes ? { notes: [ladder.notes] } : {}),
  };
}

function build_strength_b(args: {
  weekIndex: number;
  blocks: readonly Block[];
  bodyweightLb: number;
  preferences: Preferences;
  injuries: readonly Injury[];
  equipment: readonly Equipment[];
  hrp: HrpProgressionWeek;
}): SessionPrescription {
  const { weekIndex, blocks, bodyweightLb, preferences, injuries, equipment, hrp } = args;
  const ctx = { equipment, injuries, calisthenicsPreferred: preferences.calisthenicsPreferred };

  // Pick from catalog, but apply the prescription's volume rules
  const squatUni = pickFromCatalog("accessory_squat_uni", ctx, weekIndex);
  const pushAccessory = pickFromCatalog("accessory_push", ctx, weekIndex + 1);
  const coreAccessory = pickFromCatalog("accessory_core", ctx, weekIndex + 3);

  const main: ExerciseRow[] = [];

  if (preferences.calisthenicsPreferred) {
    if (squatUni) main.push(catalogItemAsExerciseRow(squatUni));
    const explosive = pickFromCatalog("accessory_explosive", ctx, weekIndex + 2);
    if (explosive) main.push(catalogItemAsExerciseRow(explosive));
    if (pushAccessory) main.push(catalogItemAsExerciseRow(pushAccessory));
  } else {
    const squat = squatPrescription(bodyweightLb, weekIndex, blocks);
    main.push({
      name: injurySwap("Back squat", injuries),
      sets: squat.sets,
      reps: squat.reps,
      weightLb: squat.weightLb,
      weightDescriptor: `${squat.weightLb} lb`,
    });
    if (squatUni) main.push(catalogItemAsExerciseRow(squatUni));
    const hingeOrCarry = pickFromCatalog("accessory_carry", ctx, weekIndex + 2) ??
      pickFromCatalog("accessory_hinge", ctx, weekIndex + 2);
    if (hingeOrCarry) main.push(catalogItemAsExerciseRow(hingeOrCarry));
  }

  // HRP is always present — it's a tested event
  for (const sr of hrp.setsReps) {
    main.push({
      name: injurySwap("Hand-release push-up", injuries),
      sets: sr.sets,
      reps: sr.reps,
    });
  }

  if (coreAccessory) main.push(catalogItemAsExerciseRow(coreAccessory));

  return {
    sessionType: "strength_b",
    title: "Strength B — Posterior + push",
    rpeTarget: 7,
    warmup: ["5 min row", "Hip openers, ankle dorsiflexion", "Bodyweight squat × 15, glute bridge × 15"],
    main,
    cooldown: ["5 min walk", "Pigeon pose 60s/side", "Calf stretch on wall 30s/side"],
    ...(hrp.amrapTarget
      ? { notes: [`AMRAP HRP target this week: ${hrp.amrapTarget} reps in 2:00`] }
      : {}),
  };
}

function build_intervals(args: {
  paces: PaceZones;
  weekIndex: number;
  block: string;
  injuries: readonly Injury[];
}): SessionPrescription {
  const { paces, weekIndex, block, injuries } = args;
  // Block-scaled distance × reps: 400 in Base, 800 in Build, 1200 in Peak, 400 in Test
  let work: { reps: number; distance: 400 | 800 | 1200; paceSec: number };
  if (block === "Base") work = { reps: 8, distance: 400, paceSec: paces.pace400Sec };
  else if (block === "Build") work = { reps: 6, distance: 800, paceSec: paces.pace800Sec };
  else if (block === "Peak") work = { reps: 4, distance: 1200, paceSec: paces.pace1200Sec };
  else work = { reps: 4, distance: 400, paceSec: paces.pace400Sec };

  const restSec =
    work.distance === 400 ? 90 : work.distance === 800 ? 180 : 240;

  return {
    sessionType: "intervals",
    title: `Intervals — ${work.reps}×${work.distance}m`,
    rpeTarget: 9,
    warmup: [
      "10 min easy jog at Easy pace",
      "Dynamic drills: high-knees, A-skips, butt kicks (20m each, 2 rounds)",
      `4 × 20m strides (build to ${secToMmss(paces.repetitionPerMileSec)} per mile)`,
    ],
    main: [
      {
        name: injurySwap(
          `${work.reps} × ${work.distance}m @ ${secToMmss(work.paceSec)}`,
          injuries,
        ),
        sets: work.reps,
        reps: 1,
        notes: `Rest ${secToMmss(restSec)} jog between reps. Don't bank time — hit the pace.`,
      },
    ],
    cooldown: [`10 min easy jog @ ${secToMmss(paces.easyPerMileSec)}/mi`, "Quad/hamstring stretches"],
    notes: [`Week ${weekIndex + 1} of plan; pace built from VDOT ${paces.vdot}.`],
  };
}

function build_tempo(args: {
  paces: PaceZones;
  block: string;
  injuries: readonly Injury[];
}): SessionPrescription {
  const { paces, block, injuries } = args;
  const miles = block === "Base" ? 2 : block === "Build" ? 3 : block === "Peak" ? 4 : 1.5;
  return {
    sessionType: "tempo",
    title: `Tempo — ${miles} mi @ ${secToMmss(paces.tempoPerMileSec)}/mi`,
    rpeTarget: 7,
    warmup: ["10 min easy jog", "4 strides × 20m"],
    main: [
      {
        name: injurySwap(`Tempo run ${miles} mi @ ${secToMmss(paces.tempoPerMileSec)}/mi`, injuries),
        sets: 1,
        reps: 1,
      },
    ],
    cooldown: ["10 min easy jog", "Calves, hip flexors"],
  };
}

function build_long(args: { paces: PaceZones; weekIndex: number; block: string }): SessionPrescription {
  const { paces, weekIndex, block } = args;
  const baseDistance = 3 + Math.min(5, Math.floor(weekIndex / 2) * 0.5);
  const miles = block === "Test" ? 2 : Number(baseDistance.toFixed(1));
  return {
    sessionType: "long",
    title: `Long run — ${miles} mi @ ${secToMmss(paces.easyPerMileSec)}/mi`,
    rpeTarget: 5,
    warmup: ["5 min brisk walk → easy jog"],
    main: [
      {
        name: `Continuous run ${miles} mi @ ${secToMmss(paces.easyPerMileSec)}/mi`,
        sets: 1,
        reps: 1,
      },
    ],
    cooldown: ["5 min walk", "Standing forward fold, pigeon pose"],
    notes: ["Conversational effort. If you can't speak in full sentences, slow down."],
  };
}

function build_aft_skills(args: {
  plk: PlankProgressionWeek;
  hrp: HrpProgressionWeek;
  sdcSec: { current: number; goal: number };
  weekIndex: number;
  blocks: readonly Block[];
  equipment: readonly Equipment[];
}): SessionPrescription {
  const { plk, hrp, sdcSec, weekIndex, blocks, equipment } = args;
  const sdcPlan = makeSdcSession(sdcSec.current, sdcSec.goal, weekIndex, blocks, equipment);

  const main: ExerciseRow[] = [];
  // SDC component
  if (sdcPlan.kind === "event") {
    main.push({
      name: "SDC full event",
      sets: 1,
      reps: `target ${secToMmss(sdcPlan.targetTimeSec)} @ ${sdcPlan.effortPct}%`,
      notes: sdcPlan.notes,
    });
  } else {
    main.push({
      name: "SDC proxy",
      sets: sdcPlan.shuttles,
      reps: 1,
      notes: SDC_PROXY_NOTE(sdcPlan.shuttles, sdcPlan.sprintMeters, sdcPlan.farmerCarryWeightLb),
    });
  }
  // HRP component (lighter than Strength B's volume)
  for (const sr of hrp.setsReps) {
    main.push({ name: "Hand-release push-up (technique focus)", sets: sr.sets, reps: Math.round(sr.reps * 0.6) });
  }
  // Plank component
  main.push({
    name: "Plank holds (3 sets)",
    sets: plk.setsHoldsSec.length,
    reps: 1,
    notes: plk.setsHoldsSec.map((s) => `${secToMmss(s)}`).join(", ") + " between-set rest 90s",
  });
  if (plk.maxAttempt) {
    main.push({
      name: "Plank max attempt",
      sets: 1,
      reps: 1,
      notes: `Target ${secToMmss(plk.maxAttempt)}+`,
    });
  }

  return {
    sessionType: "aft_skills",
    title: "AFT skills — SDC + HRP + Plank",
    rpeTarget: 7,
    warmup: ["10 min easy jog or row", "Dynamic mobility flow", ...(hasSdcGear(equipment) ? ["Light KB swing × 10, walking lunge × 10/side"] : [])],
    main,
    cooldown: ["5 min walk", "Hip flexor + thoracic mobility"],
  };
}

function build_recovery(): SessionPrescription {
  return {
    sessionType: "recovery",
    title: "Active recovery",
    rpeTarget: 3,
    warmup: ["Mobility flow", ...MOBILITY_BLOCK],
    main: ACTIVE_RECOVERY.map<ExerciseRow>((line, i) => ({
      name: line,
      sets: 1,
      reps: i === 0 ? "as listed" : 1,
    })),
    cooldown: ["Box breathing 4-4-4-4 × 8 rounds"],
    notes: ["Goal: increase blood flow, restore mobility, lower HRV-stress. Do not chase a workout."],
  };
}

function build_rest(): SessionPrescription {
  return {
    sessionType: "rest",
    title: "Rest day",
    warmup: [],
    main: [{ name: "Rest — no scheduled training", sets: 1, reps: 1 }],
    cooldown: [],
    notes: ["Sleep target 7+ hours. Hydrate. Walk if you'd like."],
  };
}

/* ----------------------------- top-level day builder ----------------------------- */

export function buildWeekDays(args: {
  weekIndex: number;
  blocks: readonly Block[];
  input: PlanInput;
  paces: PaceZones;
  ladder: MdlLadderWeek;
  plk: PlankProgressionWeek;
  hrp: HrpProgressionWeek;
}): readonly DayPlan[] {
  const { weekIndex, blocks, input, paces, ladder, plk, hrp } = args;
  const block = blockForWeek(weekIndex, blocks);
  const schedule = assignSessionDays(input.daysPerWeek, input.preferences);

  return schedule.map((sessionType, dayOfWeek): DayPlan => {
    let session: SessionPrescription;
    switch (sessionType) {
      case "strength_a":
        session = build_strength_a({
          ladder,
          weekIndex,
          preferences: input.preferences,
          injuries: input.injuries,
          equipment: input.equipment,
        });
        break;
      case "strength_b":
        session = build_strength_b({
          weekIndex,
          blocks,
          bodyweightLb: input.bodyweightLb,
          preferences: input.preferences,
          injuries: input.injuries,
          equipment: input.equipment,
          hrp,
        });
        break;
      case "intervals":
        session = build_intervals({
          paces,
          weekIndex,
          block,
          injuries: input.injuries,
        });
        break;
      case "tempo":
        session = build_tempo({ paces, block, injuries: input.injuries });
        break;
      case "long":
        session = build_long({ paces, weekIndex, block });
        break;
      case "aft_skills":
        session = build_aft_skills({
          plk,
          hrp,
          sdcSec: { current: input.current.SDC, goal: input.goal.SDC },
          weekIndex,
          blocks,
          equipment: input.equipment,
        });
        break;
      case "recovery":
        session = build_recovery();
        break;
      case "rest":
      default:
        session = build_rest();
        break;
    }
    return { dayOfWeek, session };
  });
}
