import { z } from "zod";
import type { Plan, SessionType } from "@/lib/planner";
import { secToMmss } from "@/lib/scoring";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { recordGroqCall } from "./usage";
import { getGroqClient } from "./client";

/* ----------------------------- edit schema ----------------------------- */

const SESSION_TYPES: readonly SessionType[] = [
  "strength_a",
  "strength_b",
  "intervals",
  "tempo",
  "long",
  "aft_skills",
  "sdc",
  "recovery",
  "rest",
];

const ExerciseRowSchema = z.object({
  name: z.string().min(1).max(80),
  sets: z.number().int().min(1).max(20),
  reps: z.union([z.number().int().min(1).max(100), z.string().max(20)]),
  weightLb: z.number().int().min(0).max(700).optional(),
  weightDescriptor: z.string().max(60).optional(),
  notes: z.string().max(300).optional(),
});

const EditOpSchema = z.object({
  weekIndex: z.number().int().min(0).max(25),
  dayOfWeek: z.number().int().min(0).max(6),
  action: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("replace_session"),
      sessionType: z.enum(SESSION_TYPES as unknown as [string, ...string[]]),
      title: z.string().min(3).max(100),
      main: z.array(ExerciseRowSchema).min(1).max(12),
      note: z.string().max(300).optional(),
    }),
    z.object({
      type: z.literal("add_note"),
      text: z.string().min(1).max(300),
    }),
    z.object({
      type: z.literal("rest_day"),
      reason: z.string().max(200).optional(),
    }),
  ]),
});

export const CHAT_RESPONSE_SCHEMA = z.object({
  reply: z.string().min(10).max(2000),
  edits: z.array(EditOpSchema).max(20),
});

export type EditOp = z.infer<typeof EditOpSchema>;
export type ChatResponse = z.infer<typeof CHAT_RESPONSE_SCHEMA>;

/* ----------------------------- prompt ----------------------------- */

const SYSTEM_PROMPT = `You are a US Army Fitness Test (AFT) coach helping an athlete adjust their existing training plan via chat.
You receive: the athlete's current plan (block layout, weekly schedule, prescriptions) and their message.
You return STRICT JSON with two fields: "reply" (your prose response to the athlete) and "edits" (a list of structured changes to apply to the plan).

EDIT TYPES:
- replace_session: completely swap the session for one day. Specify weekIndex (0-based), dayOfWeek (0=Mon..6=Sun), the new sessionType, a short title, and the new main exercise list.
- add_note: attach a note to a specific day without changing the session.
- rest_day: convert a day to rest (no main exercises).

RULES:
- Output STRICT JSON only. No prose outside the JSON object.
- Be conservative. Make the smallest change that satisfies the request.
- weekIndex is 0-based (week 1 in the UI = weekIndex 0).
- dayOfWeek is 0=Monday..6=Sunday.
- For replace_session, the new main list must be specific (named exercises, sets, reps, weight if applicable). Never invent weights heavier than the athlete's current MDL goal. Use the athlete's existing equipment and respect their listed injuries.
- If the athlete asks for something you can't do safely or makes no sense (e.g., "skip the deadlift event"), explain in "reply" and return an empty edits array.
- Always include a "reply" — a 1-3 sentence summary explaining what you changed and why.
- Keep total edits per turn small (typically 1-5).`;

function condensePlanForChat(plan: Plan): string {
  const lines: string[] = [];
  lines.push(`ATHLETE: age ${plan.input.age}, sex ${plan.input.sex}, ${plan.input.bodyweightLb} lb, ${plan.input.daysPerWeek} days/wk`);
  lines.push(`Equipment: ${plan.input.equipment.length ? plan.input.equipment.join(", ") : "(none)"}`);
  lines.push(`Injuries: ${plan.input.injuries.length ? plan.input.injuries.join(", ") : "none"}`);
  lines.push(`Calisthenics preferred: ${plan.input.preferences.calisthenicsPreferred}`);
  lines.push("");
  lines.push(`PLAN: ${plan.input.durationWeeks} weeks, test date ${plan.input.testDate}`);
  lines.push(`Goals: MDL ${plan.input.goal.MDL} lb, HRP ${plan.input.goal.HRP} reps, SDC ${secToMmss(plan.input.goal.SDC)}, PLK ${secToMmss(plan.input.goal.PLK)}, 2MR ${secToMmss(plan.input.goal["2MR"])}`);
  lines.push("");
  lines.push("BLOCKS:");
  for (const b of plan.blocks) {
    lines.push(`  ${b.name}: wks ${b.startWeekIndex + 1}-${b.startWeekIndex + b.weeks}`);
  }
  lines.push("");
  lines.push("WEEKLY SCHEDULE (Mon..Sun):");
  for (const w of plan.weeks) {
    const summary = w.days
      .map((d, i) => `${["M", "T", "W", "T", "F", "S", "S"][i]}=${d.session.sessionType}`)
      .join(" ");
    lines.push(`  Wk ${w.weekIndex + 1} (${w.block}): ${summary}`);
  }
  return lines.join("\n");
}

function condenseRecentHistory(
  history: ReadonlyArray<{ role: "user" | "assistant"; content: string }>,
): string {
  if (!history.length) return "";
  const lines: string[] = ["RECENT CHAT (oldest first):"];
  for (const m of history.slice(-6)) {
    lines.push(`${m.role.toUpperCase()}: ${m.content.slice(0, 400)}`);
  }
  return lines.join("\n");
}

/* ----------------------------- caller ----------------------------- */

export async function generateChatResponse(args: {
  plan: Plan;
  userMessage: string;
  history: ReadonlyArray<{ role: "user" | "assistant"; content: string }>;
  userId?: string;
}): Promise<ChatResponse | null> {
  const client = getGroqClient();
  if (!client) return null;

  const planContext = condensePlanForChat(args.plan);
  const recent = condenseRecentHistory(args.history);
  const schemaHint = `Output JSON of shape:
{
  "reply": "1-3 sentences",
  "edits": [
    { "weekIndex": 0, "dayOfWeek": 3, "action": { "type": "replace_session", "sessionType": "recovery", "title": "...", "main": [{ "name": "...", "sets": 3, "reps": "10/side" }] } },
    { "weekIndex": 2, "dayOfWeek": 5, "action": { "type": "add_note", "text": "..." } },
    { "weekIndex": 4, "dayOfWeek": 6, "action": { "type": "rest_day", "reason": "..." } }
  ]
}`;

  try {
    const completion = await client.chat.completions.create({
      model: env.groqModel,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `${planContext}\n\n${recent}\n\nATHLETE MESSAGE: ${args.userMessage}\n\n${schemaHint}`,
        },
      ],
    });

    if (args.userId) {
      void recordGroqCall({
        userId: args.userId,
        model: env.groqModel,
        purpose: "chat",
        inputTokens: completion.usage?.prompt_tokens,
        outputTokens: completion.usage?.completion_tokens,
      });
    }

    const content = completion.choices[0]?.message.content;
    if (!content) {
      logger.warn("groq chat: empty content");
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "groq chat: JSON parse failed");
      return null;
    }
    const result = CHAT_RESPONSE_SCHEMA.safeParse(parsed);
    if (!result.success) {
      logger.warn(
        { issues: result.error.issues.slice(0, 3).map((i) => i.message) },
        "groq chat: schema mismatch",
      );
      return { reply: typeof (parsed as { reply?: unknown }).reply === "string" ? String((parsed as { reply: string }).reply) : "I'm not sure how to make that change safely. Try a more specific request.", edits: [] };
    }
    return result.data;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "groq chat: call failed");
    return null;
  }
}
