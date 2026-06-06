import { blockForWeek, progressThroughBlock } from "./periodization";
import type { Block, PlankProgressionWeek } from "./types";

/**
 * Plank hold progression toward the goal hold time.
 *
 * Three holds per session, increasing each block. Friday session gets a max attempt.
 * Holds approach the goal asymptotically — Peak weeks should be hitting >90% of goal hold.
 */
export function makePlankProgression(
  currentPlkSec: number,
  goalPlkSec: number,
  durationWeeks: number,
  blocks: readonly Block[],
): readonly PlankProgressionWeek[] {
  const out: PlankProgressionWeek[] = [];
  // Working-hold target as fraction of goal, by block (where progress 0→1 within block).
  const targetFracFor = (blockName: string, progress: number): number => {
    if (blockName === "Base") return 0.55 + 0.15 * progress; // 55→70% of goal
    if (blockName === "Build") return 0.7 + 0.15 * progress; // 70→85%
    if (blockName === "Peak") return 0.85 + 0.1 * progress;  // 85→95%
    return 1.0;                                              // Test week — go for goal
  };

  for (let w = 0; w < durationWeeks; w++) {
    const block = blockForWeek(w, blocks);
    const progress = progressThroughBlock(w, blocks);
    const baseHold = Math.max(
      currentPlkSec + 10, // never regress below current+10s
      Math.round(goalPlkSec * targetFracFor(block, progress)),
    );
    // Three working holds, last one slightly longer if we have headroom.
    const holds = [baseHold, baseHold, Math.min(goalPlkSec, baseHold + 10)];
    const maxAttempt =
      block === "Test"
        ? goalPlkSec
        : (w + 1) % 4 === 0
          ? Math.round((baseHold + goalPlkSec) / 2)
          : undefined;
    out.push({ weekIndex: w, setsHoldsSec: holds, maxAttempt });
  }
  return out;
}
