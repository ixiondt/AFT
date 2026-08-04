import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { generateAtCoachResponse } from "@/lib/groq/at-coach";
import type { AtPlan } from "./index";

export async function loadAtChatHistory(atPlanId: string) {
  return db.query.atChatMessages.findMany({
    where: eq(schema.atChatMessages.atPlanId, atPlanId),
    orderBy: [asc(schema.atChatMessages.createdAt)],
  });
}

export async function postAtChatMessage(args: {
  userId: string;
  unitId: string;
  atPlanId: string;
  message: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = args.message.trim();
  if (!trimmed || trimmed.length > 2000) {
    return { ok: false, error: "Message must be 1-2000 characters" };
  }

  // Scope: the AT plan must belong to this unit.
  const planRow = await db.query.atPlans.findFirst({
    where: and(
      eq(schema.atPlans.id, args.atPlanId),
      eq(schema.atPlans.unitId, args.unitId),
    ),
  });
  if (!planRow) return { ok: false, error: "AT plan not found" };
  const plan = planRow.payload as AtPlan;

  const history = await loadAtChatHistory(args.atPlanId);

  await db.insert(schema.atChatMessages).values({
    atPlanId: args.atPlanId,
    unitId: args.unitId,
    userId: args.userId,
    role: "user",
    content: trimmed,
  });

  const reply = await generateAtCoachResponse({
    plan,
    userMessage: trimmed,
    history: history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    userId: args.userId,
  });

  await db.insert(schema.atChatMessages).values({
    atPlanId: args.atPlanId,
    unitId: args.unitId,
    userId: args.userId,
    role: "assistant",
    content: reply ?? "I can't reach the AI right now. Try again in a moment, or rephrase.",
  });

  return reply ? { ok: true } : { ok: false, error: "AI unavailable" };
}
