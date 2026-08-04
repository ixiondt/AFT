import { ageToBracket, pointGapByEvent, scoreAft } from "@/lib/scoring";
import { scoreAftProfiled, type ProfileScoringSpec } from "@/lib/scoring/profiled";
import { makeBlocks } from "./periodization";
import { computePaceZones } from "./pace";
import { makeMdlLadder } from "./strength";
import { makePlankProgression } from "./plank";
import { makeHrpProgression } from "./hrp";
import { buildWeekDays } from "./days";
import { makeCheckpoints } from "./checkpoints";
import { computeRealismWarnings } from "./realism";
import { applyAccommodations } from "./accommodations";
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

  // When a medical profile applies, the *displayed* totals follow the doctrinal
  // profiled scoring (exempt events excluded, alternate aerobic as Go/No-Go).
  // The goal total assumes a Go on the alternate (aspirational). Gaps stay on
  // the full 5-event basis; the accommodation pass drops exempt events from them.
  let currentTotal = currentScore.total;
  let goalTotal = goalScore.total;
  if (input.profile) {
    const spec = (result?: "go" | "no_go"): ProfileScoringSpec => ({
      profileType: input.profile!.profileType ?? "permanent",
      exemptEvents: input.profile!.exemptEvents,
      alternateAerobic: input.profile!.alternateAerobic === "none" ? "none" : input.profile!.alternateAerobic,
      ...(result ? { alternateResult: result } : {}),
    });
    currentTotal = scoreAftProfiled({
      age: input.age,
      sex: input.sex,
      raw: input.current,
      profile: spec(input.profile.alternateResult),
    }).total;
    goalTotal = scoreAftProfiled({
      age: input.age,
      sex: input.sex,
      raw: input.goal,
      profile: spec("go"),
    }).total;
  }

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
  const realism = computeRealismWarnings({
    age: input.age,
    sex: input.sex,
    durationWeeks: input.durationWeeks,
    current: input.current,
    goal: input.goal,
  });

  const plan: Plan = {
    input,
    bracket,
    currentTotal,
    goalTotal,
    gaps,
    blocks,
    paces,
    mdlLadder,
    plankProgression,
    hrpProgression,
    weeks,
    checkpoints,
    realism,
    generatedAt: now.toISOString(),
  };

  // Reshape the plan to fit any medical-profile accommodations. No-op (returns
  // `plan` unchanged) when the athlete has no profile.
  return applyAccommodations(plan, input.profile);
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
