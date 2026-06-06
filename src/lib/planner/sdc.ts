import { blockForWeek } from "./periodization";
import type { Block, Equipment, SdcSessionPlan } from "./types";

const SDC_GEAR: readonly Equipment[] = ["sled", "kettlebell"];

/** True if the user has the actual SDC implements. */
export function hasSdcGear(equipment: readonly Equipment[]): boolean {
  return SDC_GEAR.every((g) => equipment.includes(g));
}

/**
 * Generate a weekly SDC session prescription.
 *
 * Decision tree:
 *   - Gap > 0 (need to improve): aggressive — full event @ 95-100% effort once per week
 *   - Gap == 0 (maintain): single maintenance session @ 90% effort weekly, lower in Peak
 *   - No gear: proxy with sprints + farmer carries + lateral shuffles
 */
export function makeSdcSession(
  currentSdcSec: number,
  goalSdcSec: number,
  weekIndex: number,
  blocks: readonly Block[],
  equipment: readonly Equipment[],
): SdcSessionPlan {
  const block = blockForWeek(weekIndex, blocks);
  const gap = currentSdcSec - goalSdcSec; // positive = need to get faster

  if (!hasSdcGear(equipment)) {
    // Proxy: 5 shuttles approximating each event leg, scaled by block
    const sprintMeters = block === "Peak" || block === "Test" ? 50 : 40;
    const farmerWeight = block === "Base" ? 40 : block === "Build" ? 50 : 60;
    return {
      kind: "proxy",
      shuttles: 5,
      sprintMeters,
      farmerCarryWeightLb: farmerWeight,
      lateralReps: 20,
      notes:
        "No sled/KB on hand; this proxy trains the same energy systems and locomotion patterns. " +
        "Rest 90s between shuttles. If you ever get access to the event gear, swap it in.",
    };
  }

  if (gap > 0) {
    // Improve: full event timed, harder each block
    const effortByBlock: Record<string, number> = { Base: 90, Build: 95, Peak: 100, Test: 100 };
    const target = Math.max(goalSdcSec, currentSdcSec - Math.round((gap * (weekIndex + 1)) / 12));
    return {
      kind: "event",
      mode: "improve",
      targetTimeSec: target,
      effortPct: effortByBlock[block] ?? 95,
      notes:
        "Full event setup. Hold form, no kettlebell drops. " +
        "If you miss the target time by >5s, take a 5-min break and retry once.",
    };
  }

  // Maintain
  const effort = block === "Peak" ? 85 : block === "Test" ? 75 : 90;
  return {
    kind: "event",
    mode: "maintain",
    targetTimeSec: currentSdcSec,
    effortPct: effort,
    notes:
      "Maintenance session. Target current 5-shuttle time at the listed effort percentage. " +
      "Don't redline — this slot exists so the movement pattern stays sharp.",
  };
}
