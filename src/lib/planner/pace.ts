import type { PaceZones } from "./types";

/**
 * Daniels VDOT for the 2-mile run.
 *
 * Lookup anchors (2MR time in mm:ss → VDOT). Linear interpolation between anchors.
 * Source: standard Daniels VDOT tables for the 2-mile distance (3218.69 m).
 */
const VDOT_ANCHORS_2MR_SEC_TO_VDOT: readonly [number, number][] = [
  [10 * 60 + 30, 65],
  [11 * 60 + 30, 60],
  [12 * 60 + 30, 55],
  [13 * 60 + 42, 50],
  [15 * 60 + 0, 45],
  [16 * 60 + 31, 40],
  [18 * 60 + 11, 35],
  [20 * 60 + 8, 30],
  [22 * 60 + 18, 25],
];

export function vdotFor2MR(seconds: number): number {
  const sorted = [...VDOT_ANCHORS_2MR_SEC_TO_VDOT].sort((a, b) => a[0] - b[0]);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  if (seconds <= first[0]) return first[1];
  if (seconds >= last[0]) return last[1];

  for (let i = 0; i < sorted.length - 1; i++) {
    const [t1, v1] = sorted[i]!;
    const [t2, v2] = sorted[i + 1]!;
    if (seconds >= t1 && seconds <= t2) {
      const ratio = (seconds - t1) / (t2 - t1);
      return v1 + (v2 - v1) * ratio;
    }
  }
  return last[1];
}

/** Training paces (seconds per mile) at a given VDOT, anchored on standard Daniels tables. */
const PACE_TABLE: ReadonlyArray<{
  vdot: number;
  easy: number;
  marathon: number;
  threshold: number;
  interval: number;
  repetition: number;
}> = [
  // pace values: seconds per mile
  { vdot: 30, easy: 11 * 60 + 2, marathon: 9 * 60 + 51, threshold: 9 * 60 + 11, interval: 8 * 60 + 24, repetition: 7 * 60 + 50 },
  { vdot: 35, easy: 10 * 60 + 1, marathon: 8 * 60 + 53, threshold: 8 * 60 + 12, interval: 7 * 60 + 32, repetition: 7 * 60 + 1 },
  { vdot: 40, easy: 9 * 60 + 11, marathon: 7 * 60 + 52, threshold: 7 * 60 + 21, interval: 6 * 60 + 46, repetition: 6 * 60 + 21 },
  { vdot: 45, easy: 8 * 60 + 30, marathon: 7 * 60 + 9, threshold: 6 * 60 + 38, interval: 6 * 60 + 5, repetition: 5 * 60 + 41 },
  { vdot: 50, easy: 7 * 60 + 56, marathon: 6 * 60 + 31, threshold: 6 * 60 + 4, interval: 5 * 60 + 32, repetition: 5 * 60 + 7 },
  { vdot: 55, easy: 7 * 60 + 25, marathon: 6 * 60 + 1, threshold: 5 * 60 + 35, interval: 5 * 60 + 4, repetition: 4 * 60 + 41 },
  { vdot: 60, easy: 6 * 60 + 58, marathon: 5 * 60 + 35, threshold: 5 * 60 + 11, interval: 4 * 60 + 42, repetition: 4 * 60 + 17 },
];

function interpRow(
  vdot: number,
): { easy: number; marathon: number; threshold: number; interval: number; repetition: number } {
  const first = PACE_TABLE[0]!;
  const last = PACE_TABLE[PACE_TABLE.length - 1]!;
  if (vdot <= first.vdot) return first;
  if (vdot >= last.vdot) return last;
  for (let i = 0; i < PACE_TABLE.length - 1; i++) {
    const a = PACE_TABLE[i]!;
    const b = PACE_TABLE[i + 1]!;
    if (vdot >= a.vdot && vdot <= b.vdot) {
      const r = (vdot - a.vdot) / (b.vdot - a.vdot);
      return {
        easy: a.easy + (b.easy - a.easy) * r,
        marathon: a.marathon + (b.marathon - a.marathon) * r,
        threshold: a.threshold + (b.threshold - a.threshold) * r,
        interval: a.interval + (b.interval - a.interval) * r,
        repetition: a.repetition + (b.repetition - a.repetition) * r,
      };
    }
  }
  return last;
}

/** Per-mile pace → per-distance pace (e.g. 400m, 800m). */
function pacePerMileToDistance(perMileSec: number, meters: number): number {
  const milesInDist = meters / 1609.344;
  return perMileSec * milesInDist;
}

export function computePaceZones(current2MRSec: number, goal2MRSec: number): PaceZones {
  const vdot = vdotFor2MR(current2MRSec);
  const row = interpRow(vdot);
  const goalPacePerMileSec = (goal2MRSec / 2);
  return {
    vdot: Number(vdot.toFixed(1)),
    easyPerMileSec: Math.round(row.easy),
    marathonPerMileSec: Math.round(row.marathon),
    tempoPerMileSec: Math.round(row.threshold),
    intervalPerMileSec: Math.round(row.interval),
    repetitionPerMileSec: Math.round(row.repetition),
    pace400Sec: Math.round(pacePerMileToDistance(row.interval, 400)),
    pace800Sec: Math.round(pacePerMileToDistance(row.interval, 800)),
    pace1200Sec: Math.round(pacePerMileToDistance(row.interval, 1200)),
    goal2MRPaceSec: Math.round(goalPacePerMileSec),
  };
}
