import { secToMmss } from "@/lib/scoring";
import type { AtAbilityGroup, AtAbilityGroupKey, AtPlan } from "./types";

/** A structured change the AT coach can apply to a generated plan. */
export type AtEditOp =
  | { type: "add_day_note"; dayIndex: number; text: string }
  | { type: "set_rest"; dayIndex: number; reason?: string }
  | { type: "set_day"; dayIndex: number; title: string; activities: string[] }
  | { type: "move_member"; memberId: string; toGroup: AtAbilityGroupKey };

const FALLBACK_PREP = ["Preparation Drill (PRT); 5 min easy movement to raise core temp"];
const FALLBACK_RECOVERY = ["Recovery Drill (PRT); hydrate; stretch"];

function runLineForGroup(g: AtAbilityGroup): string {
  if (g.modality) return `Alternate aerobic — ${g.modality} (no running)`;
  if (g.prescribedPacePerMileSec) return `${g.label} — easy runs @ ${secToMmss(g.prescribedPacePerMileSec)}/mi`;
  return `${g.label} — assigned pace`;
}

/**
 * Apply one coach edit to an AT plan. Pure — returns a new plan, or the same
 * plan unchanged when the op can't apply (bad index, missing group, etc.).
 */
export function applyAtEdit(plan: AtPlan, op: AtEditOp): AtPlan {
  switch (op.type) {
    case "add_day_note": {
      const schedule = plan.schedule.map((d) =>
        d.dayIndex === op.dayIndex
          ? { ...d, activities: [...d.activities, `Note: ${op.text}`] }
          : d,
      );
      return { ...plan, schedule };
    }

    case "set_rest": {
      const schedule = plan.schedule.map((d) =>
        d.dayIndex === op.dayIndex
          ? {
              ...d,
              rest: true,
              title: "Rest / recovery day",
              preparation: [],
              activities: [op.reason ? `Rest — ${op.reason}` : "Rest. Hydrate, mobility, sleep."],
              recovery: [],
            }
          : d,
      );
      return { ...plan, schedule };
    }

    case "set_day": {
      const activities = op.activities.filter((a) => a.trim().length > 0);
      if (activities.length === 0) return plan;
      const schedule = plan.schedule.map((d) =>
        d.dayIndex === op.dayIndex
          ? {
              ...d,
              rest: false,
              title: op.title,
              activities,
              // Restore a formation warm-up/cool-down if the day had been a rest day.
              preparation: d.preparation.length ? d.preparation : FALLBACK_PREP,
              recovery: d.recovery.length ? d.recovery : FALLBACK_RECOVERY,
            }
          : d,
      );
      return { ...plan, schedule };
    }

    case "move_member": {
      const target = plan.groups.find((g) => g.key === op.toGroup);
      if (!target) return plan; // don't invent a group
      if (!plan.cards.some((c) => c.memberId === op.memberId)) return plan;

      const groups = plan.groups.map((g) => ({
        ...g,
        memberIds:
          g.key === op.toGroup
            ? [...new Set([...g.memberIds, op.memberId])]
            : g.memberIds.filter((id) => id !== op.memberId),
      }));
      const cards = plan.cards.map((c) =>
        c.memberId === op.memberId
          ? { ...c, abilityGroup: op.toGroup, runPrescription: runLineForGroup(target) }
          : c,
      );
      return { ...plan, groups, cards };
    }

    default:
      return plan;
  }
}

/** One-line human summary of an applied edit, for the chat transcript. */
export function summarizeAtEdit(op: AtEditOp, plan: AtPlan): string {
  switch (op.type) {
    case "add_day_note":
      return `Day ${op.dayIndex + 1}: + note`;
    case "set_rest":
      return `Day ${op.dayIndex + 1}: → rest`;
    case "set_day":
      return `Day ${op.dayIndex + 1}: → ${op.title}`;
    case "move_member": {
      const name = plan.cards.find((c) => c.memberId === op.memberId)?.displayName ?? "soldier";
      return `${name} → ${op.toGroup}`;
    }
    default:
      return "(change)";
  }
}
