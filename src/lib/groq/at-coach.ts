import { z } from "zod";
import { secToMmss } from "@/lib/scoring";
import type { AtPlan } from "@/lib/at";
import type { AtEditOp } from "@/lib/at/edits";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { recordGroqCall } from "./usage";
import { getGroqClient } from "./client";

/* ----------------------------- edit schema ----------------------------- */

const AtEditOpSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("add_day_note"),
    dayIndex: z.number().int().min(0).max(20),
    text: z.string().min(1).max(300),
  }),
  z.object({
    type: z.literal("set_rest"),
    dayIndex: z.number().int().min(0).max(20),
    reason: z.string().max(200).optional(),
  }),
  z.object({
    type: z.literal("set_day"),
    dayIndex: z.number().int().min(0).max(20),
    title: z.string().min(3).max(100),
    activities: z.array(z.string().min(1).max(200)).min(1).max(10),
  }),
  z.object({
    type: z.literal("move_member"),
    memberId: z.string().min(1).max(64),
    toGroup: z.enum(["A", "B", "C", "ALT", "UNASSESSED"]),
  }),
]);

export const AT_COACH_RESPONSE_SCHEMA = z.object({
  reply: z.string().min(1).max(2000),
  edits: z.array(AtEditOpSchema).max(20).default([]),
});
export type AtCoachResponse = { reply: string; edits: AtEditOp[] };

const SYSTEM_PROMPT = `You are an assistant to a US Army Master Fitness Trainer (MFT) planning and running unit Physical Training for Annual Training (AT).

Ground every answer in Army doctrine (FM 7-22 Holistic Health and Fitness):
- PRT session structure: Preparation → Activities → Recovery.
- Ability Group Runs (AGR): soldiers sorted by run ability; each group is paced so the slowest member can hold it.
- The AFT events: MDL (deadlift), HRP (hand-release push-up), SDC (sprint-drag-carry), PLK (plank), 2MR (2-mile run).

You receive the unit's generated AT plan: ability groups (with paces), the daily schedule (dayIndex is 0-based), and per-soldier cards (each with a memberId, baseline, and any medical-profile accommodations).

Return STRICT JSON: { "reply": "...", "edits": [ ... ] }.
- "reply": 1-4 sentences to the MFT.
- "edits": structured changes to APPLY to the plan (empty array if the MFT only asked a question).

EDIT TYPES:
- add_day_note { dayIndex, text } — attach a note to a day.
- set_rest { dayIndex, reason? } — make a day a rest day.
- set_day { dayIndex, title, activities[] } — replace a day's title + activity lines (Preparation/Recovery are kept).
- move_member { memberId, toGroup } — reassign a soldier to ability group A/B/C/ALT/UNASSESSED. Use the exact memberId from the SOLDIERS list.

RULES:
- Output STRICT JSON only, no prose outside the object.
- Respect every medical profile: NEVER move a no-run / alternate-aerobic soldier into a run group (A/B/C) — they belong in ALT. Don't prescribe running or lifting a profiled soldier can't do.
- Be conservative: the smallest change that satisfies the request. If it's just a question, return an empty edits array and answer in "reply".
- Always include a "reply" summarizing what you changed and why.`;

function condenseAtPlan(plan: AtPlan): string {
  const lines: string[] = [];
  lines.push(`UNIT: ${plan.unitName} — AT ${plan.days} days from ${plan.startDateISO}`);
  if (plan.warnings.length) lines.push(`WARNINGS: ${plan.warnings.join(" | ")}`);

  lines.push("", "ABILITY GROUPS:");
  for (const g of plan.groups) {
    const pace = g.prescribedPacePerMileSec ? ` @ ${secToMmss(g.prescribedPacePerMileSec)}/mi` : "";
    const mod = g.modality ? ` (${g.modality})` : "";
    lines.push(`  ${g.key} (${g.label}): ${g.memberIds.length} soldiers${pace}${mod} — ${g.description}`);
  }

  lines.push("", "DAILY SCHEDULE (dayIndex: title):");
  for (const d of plan.schedule) {
    lines.push(`  ${d.dayIndex}: ${d.rest ? "Rest" : d.title}`);
  }

  lines.push("", "SOLDIERS (memberId | name [group]):");
  for (const c of plan.cards) {
    const acc = c.accommodations.length ? ` | profile: ${c.accommodations.join("; ")}` : "";
    lines.push(`  ${c.memberId} | ${c.displayName} [${c.abilityGroup}] — run: ${c.runPrescription}${acc}`);
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

/** Advisory + editing coach for a unit AT plan. Returns null if Groq is unavailable. */
export async function generateAtCoachResponse(args: {
  plan: AtPlan;
  userMessage: string;
  history: ReadonlyArray<{ role: "user" | "assistant"; content: string }>;
  userId?: string;
}): Promise<AtCoachResponse | null> {
  const client = getGroqClient();
  if (!client) return null;

  try {
    const completion = await client.chat.completions.create({
      model: env.groqModel,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `${condenseAtPlan(args.plan)}\n\n${condenseHistory(args.history)}\n\nMFT MESSAGE: ${args.userMessage}\n\nReturn { "reply": "...", "edits": [...] }.`,
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

    const content = completion.choices[0]?.message.content;
    if (!content) {
      logger.warn("groq at-coach: empty content");
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "groq at-coach: JSON parse failed");
      return null;
    }
    const result = AT_COACH_RESPONSE_SCHEMA.safeParse(parsed);
    if (!result.success) {
      // Fall back to a reply-only response if the edits didn't validate.
      const reply = (parsed as { reply?: unknown }).reply;
      if (typeof reply === "string" && reply.length > 0) {
        return { reply, edits: [] };
      }
      logger.warn(
        { issues: result.error.issues.slice(0, 3).map((i) => i.message) },
        "groq at-coach: schema mismatch",
      );
      return null;
    }
    return { reply: result.data.reply, edits: result.data.edits as AtEditOp[] };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "groq at-coach: call failed");
    return null;
  }
}
