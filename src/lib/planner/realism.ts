/**
 * Realism warnings. Non-blocking — we still build whatever plan the user
 * asks for, but surface the math so they can see when goals push past
 * typical sustainable rates of improvement.
 *
 * Thresholds are conservative reference points for intermediate athletes:
 *  - MDL:    5–10 lb / month typical; 10–20 aggressive; >20 unrealistic
 *  - HRP:    2–5 reps / month typical; 6–10 aggressive; >10 unrealistic
 *  - PLK:    15–30 s / month typical; 30–60 aggressive; >60 unrealistic
 *  - 2MR:    5–15 sec-per-mile / month typical; 15–30 aggressive; >30 unrealistic
 *  - Total:  2–5 pts/wk sustainable; 5–8 aggressive; 8–15 hard; >15 unrealistic
 *
 * Returns a flat array of warnings the UI can render top-down. Empty array
 * means the plan looks within typical sustainable bounds.
 */
import type { Event, RawScores, Sex } from "@/lib/scoring/types";
import { ageToBracket, scoreEvent } from "@/lib/scoring";

export type RealismSeverity = "info" | "warn" | "danger";

export type RealismWarning = {
  severity: RealismSeverity;
  scope: "total" | "event";
  event?: Event;
  message: string;
  /** Optional one-liner the user can act on. */
  suggestion?: string;
};

const WEEKS_PER_MONTH = 4.33;

function pickSeverity(
  value: number,
  typical: number,
  hard: number,
): RealismSeverity | null {
  if (value > hard) return "danger";
  if (value > typical) return "warn";
  return null;
}

export function computeRealismWarnings(args: {
  age: number;
  sex: Sex;
  durationWeeks: number;
  current: RawScores;
  goal: RawScores;
}): RealismWarning[] {
  const warnings: RealismWarning[] = [];
  const months = args.durationWeeks / WEEKS_PER_MONTH;
  const bracket = ageToBracket(args.age);

  // -------- total points velocity --------
  const eventList: Event[] = ["MDL", "HRP", "SDC", "PLK", "2MR"];
  const currentPts = eventList.reduce(
    (a, e) => a + scoreEvent(e, bracket, args.sex, args.current[e]),
    0,
  );
  const goalPts = eventList.reduce(
    (a, e) => a + scoreEvent(e, bracket, args.sex, args.goal[e]),
    0,
  );
  const totalGain = Math.max(0, goalPts - currentPts);
  const ptsPerWeek = totalGain / args.durationWeeks;

  if (ptsPerWeek > 15) {
    warnings.push({
      severity: "danger",
      scope: "total",
      message: `Goal is +${totalGain} pts in ${args.durationWeeks} weeks (${ptsPerWeek.toFixed(1)} pts/wk). Sustainable is roughly 2–5 pts/wk.`,
      suggestion: `Stretching the plan to ${Math.ceil(totalGain / 5)} weeks would bring this to a sustainable rate.`,
    });
  } else if (ptsPerWeek > 8) {
    warnings.push({
      severity: "warn",
      scope: "total",
      message: `Goal is +${totalGain} pts in ${args.durationWeeks} weeks (${ptsPerWeek.toFixed(1)} pts/wk). Doable but ambitious — track adherence closely.`,
    });
  } else if (ptsPerWeek > 5 && args.durationWeeks < 8) {
    warnings.push({
      severity: "info",
      scope: "total",
      message: `Tight window (${args.durationWeeks} wk) for +${totalGain} pts. Plan will compress; less room to absorb missed sessions.`,
    });
  }

  // -------- MDL --------
  const mdlGain = args.goal.MDL - args.current.MDL;
  if (mdlGain > 0 && months > 0) {
    const lbPerMonth = mdlGain / months;
    const sev = pickSeverity(lbPerMonth, 12, 20);
    if (sev) {
      warnings.push({
        severity: sev,
        scope: "event",
        event: "MDL",
        message: `+${mdlGain} lb MDL in ${args.durationWeeks} wk = ${lbPerMonth.toFixed(1)} lb/month. Typical sustainable: 5–10 lb/month for intermediates.`,
        ...(sev === "danger"
          ? {
              suggestion: `Consider extending the plan or lowering the MDL goal to keep weekly progressions safe.`,
            }
          : {}),
      });
    }
  }

  // -------- HRP --------
  const hrpGain = args.goal.HRP - args.current.HRP;
  if (hrpGain > 0 && months > 0) {
    const perMonth = hrpGain / months;
    const sev = pickSeverity(perMonth, 6, 10);
    if (sev) {
      warnings.push({
        severity: sev,
        scope: "event",
        event: "HRP",
        message: `+${hrpGain} HRP reps in ${args.durationWeeks} wk = ${perMonth.toFixed(1)}/month. Typical: 2–5 reps/month.`,
      });
    }
  }

  // -------- PLK --------
  const plkGain = args.goal.PLK - args.current.PLK;
  if (plkGain > 0 && months > 0) {
    const sPerMonth = plkGain / months;
    const sev = pickSeverity(sPerMonth, 40, 60);
    if (sev) {
      warnings.push({
        severity: sev,
        scope: "event",
        event: "PLK",
        message: `+${plkGain}s plank in ${args.durationWeeks} wk = ${sPerMonth.toFixed(0)}s/month. Typical: 15–30s/month.`,
      });
    }
  }

  // -------- 2MR --------
  // Improvement = current(slow) − goal(fast). Compute per-mile pace drop.
  const drop = args.current["2MR"] - args.goal["2MR"];
  if (drop > 0 && months > 0) {
    const perMileSecPerMonth = drop / 2 / months;
    const sev = pickSeverity(perMileSecPerMonth, 18, 30);
    if (sev) {
      warnings.push({
        severity: sev,
        scope: "event",
        event: "2MR",
        message: `2MR goal requires dropping ${perMileSecPerMonth.toFixed(0)} sec/mile/month. Typical: 5–15 sec/mile/month for an aerobic build.`,
      });
    }
  }

  // -------- SDC --------
  const sdcDrop = args.current.SDC - args.goal.SDC;
  if (sdcDrop > 0 && months > 0) {
    const sPerMonth = sdcDrop / months;
    // SDC time gains are mostly aerobic + technique; capped fast in any
    // realistic window.
    if (sPerMonth > 8) {
      warnings.push({
        severity: "warn",
        scope: "event",
        event: "SDC",
        message: `SDC goal is aggressive: −${sPerMonth.toFixed(1)}s/month. SDC improvements are typically smaller (1–3s/month) once technique is dialed.`,
      });
    }
  }

  return warnings;
}
