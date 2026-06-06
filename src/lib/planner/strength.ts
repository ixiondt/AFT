import { blockForWeek, progressThroughBlock } from "./periodization";
import type { Block, MdlLadderWeek, MdlSet } from "./types";

/** Round to nearest 5 lb for plate math. */
function roundTo5(n: number): number {
  return Math.round(n / 5) * 5;
}

/**
 * Build a 3RM-target deadlift ladder over the duration of the plan.
 *
 * Block targets (as % of GOAL 3RM):
 *   Base:  68→74%   volume work (5x5)
 *   Build: 76→84%   strength (5x3, then 4x3)
 *   Peak:  86→94%   heavy (3x3 → 3x2 → 2x1 + heavy single up to 95%)
 *   Test:  ramp to attempt
 */
export function makeMdlLadder(
  goalMdlLb: number,
  durationWeeks: number,
  blocks: readonly Block[],
): readonly MdlLadderWeek[] {
  const ladder: MdlLadderWeek[] = [];
  for (let w = 0; w < durationWeeks; w++) {
    const block = blockForWeek(w, blocks);
    const progress = progressThroughBlock(w, blocks);
    let sets: MdlSet[];
    let topSingleLb: number | undefined;
    let notes: string | undefined;

    if (block === "Base") {
      const pct = 0.68 + 0.06 * progress;
      const wt = roundTo5(goalMdlLb * pct);
      sets = Array.from({ length: 5 }, () => ({ reps: 5, weightLb: wt }));
      notes = "Volume phase. Same weight all sets. Rest 2:00.";
    } else if (block === "Build") {
      const pct = 0.76 + 0.08 * progress;
      const wt = roundTo5(goalMdlLb * pct);
      sets = Array.from({ length: 5 }, () => ({ reps: 3, weightLb: wt }));
      notes = "Strength phase. Rest 2:30 between sets.";
    } else if (block === "Peak") {
      const pct = 0.86 + 0.08 * progress; // 86 → 94
      const wt = roundTo5(goalMdlLb * pct);
      const reps = progress < 0.34 ? 3 : progress < 0.67 ? 2 : 1;
      const numSets = reps === 1 ? 2 : 3;
      sets = Array.from({ length: numSets }, () => ({ reps: reps as 1 | 2 | 3, weightLb: wt }));
      if (progress >= 0.5) {
        topSingleLb = roundTo5(goalMdlLb * Math.min(0.95, 0.9 + 0.05 * progress));
      }
      notes = "Peak phase. Rest 3:00 between sets. Stop a rep short of failure.";
    } else {
      // Test week — open up to goal
      sets = [
        { reps: 3, weightLb: roundTo5(goalMdlLb * 0.5) },
        { reps: 2, weightLb: roundTo5(goalMdlLb * 0.7) },
        { reps: 1, weightLb: roundTo5(goalMdlLb * 0.85) },
        { reps: 1, weightLb: roundTo5(goalMdlLb * 0.93) },
        { reps: 3, weightLb: goalMdlLb }, // attempt
      ];
      notes = "Test day. Warm-up ladder then attempt the goal 3RM. Stop at any form breakdown.";
    }

    ladder.push({ weekIndex: w, block, sets, topSingleLb, notes });
  }
  return ladder;
}

/** Squat target as % of current bodyweight × strength factor. Simple accessory prescription. */
export function squatPrescription(
  bodyweightLb: number,
  weekIndex: number,
  blocks: readonly Block[],
): { weightLb: number; sets: number; reps: number } {
  const block = blockForWeek(weekIndex, blocks);
  const progress = progressThroughBlock(weekIndex, blocks);
  // Anchor a beginner-to-intermediate squat near bodyweight; scale by block.
  const baseLb = bodyweightLb * 0.75;
  if (block === "Base") {
    return { weightLb: roundTo5(baseLb + 10 * progress), sets: 4, reps: 6 };
  }
  if (block === "Build") {
    return { weightLb: roundTo5(baseLb + 20 + 15 * progress), sets: 4, reps: 5 };
  }
  if (block === "Peak") {
    return { weightLb: roundTo5(baseLb + 40 + 15 * progress), sets: 3, reps: 4 };
  }
  return { weightLb: roundTo5(baseLb), sets: 2, reps: 5 }; // test week — light maintenance
}
