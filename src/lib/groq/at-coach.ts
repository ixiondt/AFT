import { secToMmss } from "@/lib/scoring";
import type { AtPlan } from "@/lib/at";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { recordGroqCall } from "./usage";
import { getGroqClient } from "./client";

const SYSTEM_PROMPT = `You are an assistant to a US Army Master Fitness Trainer (MFT) planning and running unit Physical Training for Annual Training (AT).

Ground every answer in Army doctrine (FM 7-22 Holistic Health and Fitness):
- PRT session structure: Preparation → Activities → Recovery.
- Ability Group Runs (AGR): soldiers sorted by run ability, each group led at a set pace; the group is paced so the slowest member can hold it.
- The AFT events: 3-Rep-Max Deadlift (MDL), Hand-Release Push-Up (HRP), Sprint-Drag-Carry (SDC), Plank (PLK), and the 2-Mile Run (2MR).

You are given the unit's generated AT plan: ability groups (with paces), the daily schedule, and per-soldier cards (baseline scores, run/strength prescriptions, and any medical-profile accommodations).

RULES:
- Respect every medical profile. Never prescribe running for a soldier flagged no-run / alternate-aerobic; respect lift limits and exempt events.
- Be concise and practical — a few short paragraphs or a bulleted list an NCO can act on at first formation.
- Prefer specifics grounded in the plan you were given (name the ability group, the day, the soldier) over generic advice.
- You are advisory only: you cannot edit the plan. If asked to change it, explain what to adjust (roster, AT window, or regenerate) and why.
- If you don't have enough info, say what's missing (e.g., a soldier needs a baseline run).`;

function condenseAtPlan(plan: AtPlan): string {
  const lines: string[] = [];
  lines.push(`UNIT: ${plan.unitName} — AT ${plan.days} days from ${plan.startDateISO}`);
  if (plan.warnings.length) lines.push(`WARNINGS: ${plan.warnings.join(" | ")}`);

  lines.push("", "ABILITY GROUPS:");
  for (const g of plan.groups) {
    const pace = g.prescribedPacePerMileSec ? ` @ ${secToMmss(g.prescribedPacePerMileSec)}/mi` : "";
    const mod = g.modality ? ` (${g.modality})` : "";
    lines.push(`  ${g.label}: ${g.memberIds.length} soldiers${pace}${mod} — ${g.description}`);
  }

  lines.push("", "DAILY SCHEDULE:");
  for (const d of plan.schedule) {
    lines.push(`  Day ${d.dayIndex + 1}: ${d.rest ? "Rest" : d.title}`);
  }

  lines.push("", "SOLDIERS:");
  for (const c of plan.cards) {
    const score = c.aftScore
      ? ` ${c.aftScore.total}pts${c.aftScore.profiled ? `/${c.aftScore.scoredEventCount}ev` : ""}`
      : "";
    const acc = c.accommodations.length ? ` | profile: ${c.accommodations.join("; ")}` : "";
    lines.push(`  ${c.displayName} [${c.abilityGroup}]${score} — run: ${c.runPrescription}; strength: ${c.strengthPrescription}${acc}`);
  }
  return lines.join("\n");
}

function condenseHistory(
  history: ReadonlyArray<{ role: "user" | "assistant"; content: string }>,
): string {
  if (!history.length) return "";
  const lines = ["RECENT CHAT (oldest first):"];
  for (const m of history.slice(-6)) lines.push(`${m.role.toUpperCase()}: ${m.content.slice(0, 400)}`);
  return lines.join("\n");
}

/** Advisory coach reply for a unit AT plan. Returns null if Groq is unavailable. */
export async function generateAtCoachResponse(args: {
  plan: AtPlan;
  userMessage: string;
  history: ReadonlyArray<{ role: "user" | "assistant"; content: string }>;
  userId?: string;
}): Promise<string | null> {
  const client = getGroqClient();
  if (!client) return null;

  try {
    const completion = await client.chat.completions.create({
      model: env.groqModel,
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `${condenseAtPlan(args.plan)}\n\n${condenseHistory(args.history)}\n\nMFT QUESTION: ${args.userMessage}`,
        },
      ],
    });

    if (args.userId) {
      void recordGroqCall({
        userId: args.userId,
        model: env.groqModel,
        purpose: "at_coach",
        inputTokens: completion.usage?.prompt_tokens,
        outputTokens: completion.usage?.completion_tokens,
      });
    }

    const content = completion.choices[0]?.message.content?.trim();
    if (!content) {
      logger.warn("groq at-coach: empty content");
      return null;
    }
    return content;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "groq at-coach: call failed");
    return null;
  }
}
