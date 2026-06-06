import { z } from "zod";
import { secToMmss } from "@/lib/scoring";
import type { Plan } from "@/lib/planner";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getGroqClient } from "./client";

/* ----------------------------- schema ----------------------------- */

export const NARRATIVE_SCHEMA = z.object({
  blockIntros: z.object({
    Base: z.string().min(40).max(800),
    Build: z.string().min(40).max(800),
    Peak: z.string().min(40).max(800),
    Test: z.string().min(40).max(800),
  }),
  weeklyThemes: z.array(z.string().min(8).max(160)).min(1),
  exerciseSwaps: z.object({
    deadlift: z.string().max(400).optional(),
    squat: z.string().max(400).optional(),
    push: z.string().max(400).optional(),
    run: z.string().max(400).optional(),
  }),
  formCues: z.object({
    MDL: z.string().min(20).max(400),
    HRP: z.string().min(20).max(400),
    SDC: z.string().min(20).max(400),
    PLK: z.string().min(20).max(400),
    "2MR": z.string().min(20).max(400),
  }),
  closingNote: z.string().min(60).max(800),
});

export type Narrative = z.infer<typeof NARRATIVE_SCHEMA>;

/* ----------------------------- prompt ----------------------------- */

const SYSTEM_PROMPT = `You are a US Army Fitness Test (AFT) coach with a strength-and-conditioning background.
The AFT is a 5-event test: MDL (3-rep max deadlift), HRP (hand-release push-up in 2:00), SDC (sprint-drag-carry, 5 x 50m shuttles), PLK (plank hold), and 2MR (two-mile run).
You will receive an athlete profile and a deterministic training plan structure. Your job is to add a coaching voice on top of the numbers - block intros, weekly themes, exercise substitutions for injuries, form cues, and a closing note.

RULES:
- Output STRICT JSON matching the requested schema. No prose outside the JSON.
- Never change or contradict the provided weights, paces, or volumes. The math is fixed by the deterministic engine.
- Be direct and specific. No fluff, no marketing language, no emoji.
- Form cues must be actionable in one sentence (e.g., "Brace 360 degrees before the bar leaves the floor", not "focus on bracing").
- Exercise swaps are only listed for injuries the athlete actually reported. If an injury isn't in the list, omit that swap field.
- weeklyThemes must have exactly one entry per week of the plan.`;

function condensePlanForPrompt(plan: Plan): string {
  const { input, paces, blocks, gaps } = plan;
  const lines: string[] = [];
  lines.push(`ATHLETE`);
  lines.push(`- Age ${input.age}, sex lane ${input.sex}, bodyweight ${input.bodyweightLb} lb`);
  lines.push(`- Training ${input.daysPerWeek} days/wk for ${input.durationWeeks} weeks (test ${input.testDate})`);
  lines.push(`- Equipment: ${input.equipment.length ? input.equipment.join(", ") : "(none listed)"}`);
  lines.push(`- Injuries: ${input.injuries.length ? input.injuries.join(", ") : "none"}`);
  lines.push(
    `- Preferences: ${[
      input.preferences.calisthenicsPreferred ? "calisthenics-preferred" : "",
      input.preferences.activeRecovery ? "active-recovery" : "",
    ]
      .filter(Boolean)
      .join(", ") || "(defaults)"}`,
  );
  lines.push("");
  lines.push(`CURRENT AFT (${plan.currentTotal} total) → GOAL (${plan.goalTotal} total)`);
  for (const g of gaps) {
    lines.push(`- ${g.event}: ${g.currentPoints} → ${g.goalPoints} pts (gap +${g.gap})`);
  }
  lines.push("");
  lines.push(`PLAN STRUCTURE`);
  for (const b of blocks) {
    lines.push(
      `- ${b.name}: wks ${b.startWeekIndex + 1}-${b.startWeekIndex + b.weeks} (${b.weeks} wk)`,
    );
  }
  lines.push("");
  lines.push(`RUN PACES (VDOT ${paces.vdot})`);
  lines.push(`- Easy ${secToMmss(paces.easyPerMileSec)}/mi, Tempo ${secToMmss(paces.tempoPerMileSec)}/mi, Interval ${secToMmss(paces.intervalPerMileSec)}/mi`);
  lines.push(`- 400m ${secToMmss(paces.pace400Sec)}, 800m ${secToMmss(paces.pace800Sec)}, 1200m ${secToMmss(paces.pace1200Sec)}`);
  lines.push("");
  lines.push(`DEADLIFT LADDER (first/last only)`);
  const ml = plan.mdlLadder;
  const first = ml[0]!;
  const lastBlock = ml[ml.length - 2]!; // last peak week before test
  const test = ml[ml.length - 1]!;
  lines.push(
    `- Wk 1 ${first.block}: ${first.sets.length} x ${first.sets[0]!.reps} x ${first.sets[0]!.weightLb} lb`,
  );
  lines.push(
    `- Wk ${lastBlock.weekIndex + 1} ${lastBlock.block}: ${lastBlock.sets.length} x ${lastBlock.sets[0]!.reps} x ${lastBlock.sets[0]!.weightLb} lb${lastBlock.topSingleLb ? ` + single ${lastBlock.topSingleLb}` : ""}`,
  );
  lines.push(`- Wk ${test.weekIndex + 1} ${test.block}: attempt ${test.sets[test.sets.length - 1]!.weightLb} lb`);
  return lines.join("\n");
}

/* ----------------------------- caller ----------------------------- */

/**
 * Generate a coach-voice narrative for a plan. Returns null if Groq is unconfigured
 * or the call fails - callers should treat narrative as optional enrichment.
 */
export async function generateNarrative(plan: Plan): Promise<Narrative | null> {
  const client = getGroqClient();
  if (!client) return null;

  const userPayload = condensePlanForPrompt(plan);
  const schemaHint = `Output JSON with this shape:
{
  "blockIntros": { "Base": "...", "Build": "...", "Peak": "...", "Test": "..." },
  "weeklyThemes": ["wk1 theme", "wk2 theme", ... exactly ${plan.input.durationWeeks} entries],
  "exerciseSwaps": { "deadlift"?: "...", "squat"?: "...", "push"?: "...", "run"?: "..." },
  "formCues": { "MDL": "...", "HRP": "...", "SDC": "...", "PLK": "...", "2MR": "..." },
  "closingNote": "..."
}`;

  try {
    const completion = await client.chat.completions.create({
      model: env.groqModel,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `${userPayload}\n\n${schemaHint}` },
      ],
    });

    const content = completion.choices[0]?.message.content;
    if (!content) {
      logger.warn({ planId: plan.generatedAt }, "groq narrative empty content");
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "groq narrative JSON parse failed");
      return null;
    }
    const result = NARRATIVE_SCHEMA.safeParse(parsed);
    if (!result.success) {
      logger.warn(
        { issues: result.error.issues.slice(0, 3).map((i) => i.message) },
        "groq narrative schema mismatch",
      );
      return null;
    }
    // Ensure weeklyThemes length matches durationWeeks; clip or pad otherwise.
    if (result.data.weeklyThemes.length !== plan.input.durationWeeks) {
      logger.warn(
        {
          got: result.data.weeklyThemes.length,
          expected: plan.input.durationWeeks,
        },
        "groq narrative weeklyThemes length mismatch — clipping/padding",
      );
      const themes = result.data.weeklyThemes.slice(0, plan.input.durationWeeks);
      while (themes.length < plan.input.durationWeeks) {
        themes.push("Stay the course; this week mirrors the block pattern.");
      }
      return { ...result.data, weeklyThemes: themes };
    }
    return result.data;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "groq narrative call failed");
    return null;
  }
}
