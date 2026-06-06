import { blockForWeek, progressThroughBlock } from "./periodization";
import type { Block, HrpProgressionWeek } from "./types";

/**
 * Hand-release push-up volume progression.
 *
 * Three sessions per week of multiple sets at submaximal volume, plus a weekly AMRAP
 * to track real progress. Target single-set reps stays well below the user's AMRAP
 * (around 40-50%) to keep technique crisp and avoid form breakdown.
 */
export function makeHrpProgression(
  currentHrpReps: number,
  goalHrpReps: number,
  durationWeeks: number,
  blocks: readonly Block[],
): readonly HrpProgressionWeek[] {
  const out: HrpProgressionWeek[] = [];
  for (let w = 0; w < durationWeeks; w++) {
    const block = blockForWeek(w, blocks);
    const progress = progressThroughBlock(w, blocks);

    let setsReps: { sets: number; reps: number }[];
    let amrap: number | undefined;

    const setRepFor = (frac: number): number =>
      Math.max(5, Math.round(currentHrpReps * frac));

    if (block === "Base") {
      // Volume; 5 sets at 35-42% of current AMRAP
      setsReps = [{ sets: 5, reps: setRepFor(0.35 + 0.07 * progress) }];
      amrap = (w + 1) % 4 === 0 ? Math.round(currentHrpReps * 1.05) : undefined;
    } else if (block === "Build") {
      // 5 sets at 42-50% — bigger volume
      setsReps = [{ sets: 5, reps: setRepFor(0.42 + 0.08 * progress) }];
      amrap = (w + 1) % 3 === 0 ? Math.round((currentHrpReps + goalHrpReps) / 2) : undefined;
    } else if (block === "Peak") {
      // 5 sets at 50-58% of current; closer to goal AMRAP
      setsReps = [{ sets: 5, reps: setRepFor(0.5 + 0.08 * progress) }];
      amrap = Math.round(goalHrpReps - (1 - progress) * 5);
    } else {
      // Test week: light touch + the actual AFT
      setsReps = [{ sets: 2, reps: setRepFor(0.4) }];
      amrap = goalHrpReps;
    }

    out.push({ weekIndex: w, setsReps, amrapTarget: amrap });
  }
  return out;
}
