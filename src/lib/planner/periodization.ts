import type { Block, BlockName } from "./types";

const MIN_DURATION_WEEKS = 6;
const MAX_DURATION_WEEKS = 26;

/**
 * Lay out blocks for a plan of `durationWeeks`.
 *
 * Rule of thumb:
 *   1 week is always reserved for Test/Taper at the end.
 *   Remaining N-1 weeks split into Base/Build/Peak in roughly 40/35/25 ratios,
 *   floor of 1 week each. For very short plans (<= 7 wk) we collapse Base.
 */
export function makeBlocks(durationWeeks: number): readonly Block[] {
  if (
    !Number.isInteger(durationWeeks) ||
    durationWeeks < MIN_DURATION_WEEKS ||
    durationWeeks > MAX_DURATION_WEEKS
  ) {
    throw new Error(
      `durationWeeks must be an integer in [${MIN_DURATION_WEEKS}, ${MAX_DURATION_WEEKS}], got ${durationWeeks}`,
    );
  }

  const testWeeks = 1;
  const buildable = durationWeeks - testWeeks;

  let base: number;
  let build: number;
  let peak: number;

  if (durationWeeks <= 7) {
    // 6-7 wk: skip Base; split as Build/Peak/Test
    base = 0;
    peak = Math.max(1, Math.floor(buildable * 0.4));
    build = buildable - peak;
  } else {
    base = Math.max(1, Math.round(buildable * 0.4));
    peak = Math.max(1, Math.round(buildable * 0.25));
    build = buildable - base - peak;
    if (build < 1) {
      build = 1;
      // steal one from base preferentially, then peak
      if (base > 1) base -= 1;
      else peak -= 1;
    }
  }

  const out: Block[] = [];
  let cursor = 0;
  const push = (name: BlockName, weeks: number) => {
    if (weeks <= 0) return;
    out.push({ name, weeks, startWeekIndex: cursor });
    cursor += weeks;
  };
  push("Base", base);
  push("Build", build);
  push("Peak", peak);
  push("Test", testWeeks);

  return out;
}

/** Look up which block a given week index falls into. */
export function blockForWeek(
  weekIndex: number,
  blocks: readonly Block[],
): BlockName {
  for (const b of blocks) {
    if (weekIndex >= b.startWeekIndex && weekIndex < b.startWeekIndex + b.weeks) {
      return b.name;
    }
  }
  throw new Error(`weekIndex ${weekIndex} out of range of blocks`);
}

/** Return 0..1 progress through the named block for a given week. */
export function progressThroughBlock(
  weekIndex: number,
  blocks: readonly Block[],
): number {
  for (const b of blocks) {
    if (weekIndex >= b.startWeekIndex && weekIndex < b.startWeekIndex + b.weeks) {
      if (b.weeks === 1) return 1;
      return (weekIndex - b.startWeekIndex) / (b.weeks - 1);
    }
  }
  return 0;
}
