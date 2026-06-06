import { ageToBracket, scoreEvent } from "@/lib/scoring";
import type { Sex } from "@/lib/scoring/types";
import type { Checkpoint, PlanInput } from "./types";

/**
 * Insert proportional diagnostic checkpoints at ~33%, ~66%, ~95% of plan duration.
 * Each checkpoint specifies which events to test and the raw targets.
 * Targets are interpolated linearly between current and goal raw values.
 */
export function makeCheckpoints(input: PlanInput): readonly Checkpoint[] {
  const { current, goal, durationWeeks, age, sex } = input;
  const bracket = ageToBracket(age);

  const interp = (a: number, b: number, frac: number, snap = 1): number => {
    const v = a + (b - a) * frac;
    return Math.round(v / snap) * snap;
  };

  const targetsAt = (frac: number) => ({
    MDL: interp(current.MDL, goal.MDL, frac, 5), // snap to 5 lb plate increments
    HRP: interp(current.HRP, goal.HRP, frac),
    SDC: interp(current.SDC, goal.SDC, frac),
    PLK: interp(current.PLK, goal.PLK, frac),
    "2MR": interp(current["2MR"], goal["2MR"], frac),
  });

  const weekFor = (frac: number): number =>
    Math.min(durationWeeks - 1, Math.max(0, Math.round(durationWeeks * frac) - 1));

  const cp = (frac: number, label: string, events: Checkpoint["events"]): Checkpoint => {
    const targets = targetsAt(frac);
    const filteredTargets = Object.fromEntries(
      events.map((e) => [e, targets[e]]),
    ) as Partial<Record<keyof typeof targets, number>>;
    return {
      weekIndex: weekFor(frac),
      label,
      fraction: frac,
      events,
      targets: filteredTargets,
      retoolIfMissed: retoolGuidance(events, filteredTargets, bracket, sex),
    };
  };

  return [
    cp(0.33, "Day 30 — Run/Plank/HRP TT", ["2MR", "PLK", "HRP"]),
    cp(0.66, "Day 60 — 4-event diagnostic (skip SDC)", ["MDL", "HRP", "PLK", "2MR"]),
    cp(1.0, "Day 90 — Full AFT", ["MDL", "HRP", "SDC", "PLK", "2MR"]),
  ];
}

function retoolGuidance(
  events: Checkpoint["events"],
  targets: Partial<Record<string, number>>,
  bracket: ReturnType<typeof ageToBracket>,
  sex: Sex,
): readonly string[] {
  const notes: string[] = [];
  for (const ev of events) {
    const t = targets[ev];
    if (typeof t !== "number") continue;
    const pts = scoreEvent(ev, bracket, sex, t);
    notes.push(
      `${ev}: target ${formatTarget(ev, t)} (~${pts} pts). If missed by >5%: add 1–2 specific sessions/week for the next 2 weeks before the next checkpoint, then re-test.`,
    );
  }
  notes.push(
    "If two or more events are missed by >10%, pause the plan for 5–7 days, deload all volume by 30%, then resume one week earlier than scheduled.",
  );
  return notes;
}

function formatTarget(ev: string, raw: number): string {
  if (ev === "MDL") return `${raw} lb`;
  if (ev === "HRP") return `${raw} reps`;
  // time-based
  const m = Math.floor(raw / 60);
  const s = raw % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
