import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { generateAtCoachResponse } from "@/lib/groq/at-coach";
import { logger } from "@/lib/logger";
import { applyAtEdit, summarizeAtEdit, type AtEditOp } from "./edits";
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

  const response = await generateAtCoachResponse({
    plan,
    userMessage: trimmed,
    history: history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    userId: args.userId,
  });

  if (!response) {
    await db.insert(schema.atChatMessages).values({
      atPlanId: args.atPlanId,
      unitId: args.unitId,
      userId: args.userId,
      role: "assistant",
      content: "I can't reach the AI right now. Try again in a moment, or rephrase.",
    });
    return { ok: false, error: "AI unavailable" };
  }

  // Apply any edits to the plan (skipping no-ops), then persist.
  let nextPlan = plan;
  const applied: AtEditOp[] = [];
  for (const op of response.edits) {
    const before = nextPlan;
    nextPlan = applyAtEdit(nextPlan, op);
    if (nextPlan !== before) applied.push(op);
  }

  if (applied.length > 0) {
    await db
      .update(schema.atPlans)
      .set({ payload: nextPlan, updatedAt: new Date() })
      .where(eq(schema.atPlans.id, args.atPlanId));
    logger.info({ unitId: args.unitId, atPlanId: args.atPlanId, count: applied.length }, "at-coach applied edits");
  }

  const content =
    applied.length > 0
      ? `${response.reply}\n\nChanges applied:\n${applied.map((op) => `• ${summarizeAtEdit(op, nextPlan)}`).join("\n")}`
      : response.reply;

  await db.insert(schema.atChatMessages).values({
    atPlanId: args.atPlanId,
    unitId: args.unitId,
    userId: args.userId,
    role: "assistant",
    content,
    appliedEdits: applied.length ? applied : null,
  });

  return { ok: true };
}
