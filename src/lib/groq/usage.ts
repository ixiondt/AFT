import { sql, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Record a Groq call against a user. Idempotent and best-effort — failures
 * here must never break the request that triggered the LLM call.
 */
export async function recordGroqCall(args: {
  userId: string;
  model: string;
  purpose: "narrative" | "chat" | "at_coach";
  inputTokens?: number;
  outputTokens?: number;
  ok?: boolean;
}): Promise<void> {
  const inputTokens = Math.max(0, args.inputTokens ?? 0);
  const outputTokens = Math.max(0, args.outputTokens ?? 0);
  const ok = args.ok !== false;
  try {
    await db.insert(schema.groqCalls).values({
      userId: args.userId,
      model: args.model,
      purpose: args.purpose,
      inputTokens,
      outputTokens,
      okFlag: ok,
    });
    await db
      .update(schema.users)
      .set({
        groqCallCount: sql`${schema.users.groqCallCount} + 1`,
        groqInputTokens: sql`${schema.users.groqInputTokens} + ${inputTokens}`,
        groqOutputTokens: sql`${schema.users.groqOutputTokens} + ${outputTokens}`,
      })
      .where(eq(schema.users.id, args.userId));
  } catch {
    // intentionally swallow — usage tracking is best-effort
  }
}
