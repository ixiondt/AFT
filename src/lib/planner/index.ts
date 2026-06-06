import { ageToBracket, pointGapByEvent, scoreAft } from "@/lib/scoring";
import { makeBlocks } from "./periodization";
import { computePaceZones } from "./pace";
import { makeMdlLadder } from "./strength";
import { makePlankProgression } from "./plank";
import { makeHrpProgression } from "./hrp";
import { buildWeekDays } from "./days";
import { makeCheckpoints } from "./checkpoints";
import type { Plan, PlanInput, WeekPlan } from "./types";

export * from "./types";

/**
 * Generate a periodized AFT training plan from athlete inputs.
 * Deterministic — same input → same output.
 */
export function generatePlan(input: PlanInput, now: Date = new Date(0)): Plan {
  validateInput(input);

  const bracket = ageToBracket(input.age);

  const currentScore = scoreAft({ age: input.age, sex: input.sex, raw: input.current });
  const goalScore = scoreAft({ age: input.age, sex: input.sex, raw: input.goal });
  const gaps = pointGapByEvent(currentScore.events, goalScore.events);

  const blocks = makeBlocks(input.durationWeeks);
  const paces = computePaceZones(input.current["2MR"], input.goal["2MR"]);
  const mdlLadder = makeMdlLadder(input.goal.MDL, input.durationWeeks, blocks);
  const plankProgression = makePlankProgression(
    input.current.PLK,
    input.goal.PLK,
    input.durationWeeks,
    blocks,
  );
  const hrpProgression = makeHrpProgression(
    input.current.HRP,
    input.goal.HRP,
    input.durationWeeks,
    blocks,
  );

  const weeks: WeekPlan[] = [];
  for (let w = 0; w < input.durationWeeks; w++) {
    const days = buildWeekDays({
      weekIndex: w,
      blocks,
      input,
      paces,
      ladder: mdlLadder[w]!,
      plk: plankProgression[w]!,
      hrp: hrpProgression[w]!,
    });
    const block = blocks.find(
      (b) => w >= b.startWeekIndex && w < b.startWeekIndex + b.weeks,
    )!.name;
    weeks.push({ weekIndex: w, block, days });
  }

  const checkpoints = makeCheckpoints(input);

  return {
    input,
    bracket,
    currentTotal: currentScore.total,
    goalTotal: goalScore.total,
    gaps,
    blocks,
    paces,
    mdlLadder,
    plankProgression,
    hrpProgression,
    weeks,
    checkpoints,
    generatedAt: now.toISOString(),
  };
}

function validateInput(input: PlanInput): void {
  if (input.durationWeeks < 6 || input.durationWeeks > 26) {
    throw new Error(`durationWeeks must be in [6, 26], got ${input.durationWeeks}`);
  }
  if (![3, 4, 5, 6].includes(input.daysPerWeek)) {
    throw new Error(`daysPerWeek must be 3-6, got ${input.daysPerWeek}`);
  }
  if (input.current.MDL <= 0 || input.goal.MDL <= 0) {
    throw new Error("MDL values must be positive");
  }
  if (input.current["2MR"] <= 0 || input.goal["2MR"] <= 0) {
    throw new Error("2MR values must be positive (seconds)");
  }
}
