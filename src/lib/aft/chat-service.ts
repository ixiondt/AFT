import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Plan, SessionPrescription, WeekPlan } from "@/lib/planner";
import { generateChatResponse, type EditOp } from "@/lib/groq/chat";
import { logger } from "@/lib/logger";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function applyEdit(plan: Plan, op: EditOp): Plan {
  const weeks = plan.weeks.map((w) => ({ ...w, days: w.days.map((d) => ({ ...d })) }));
  const week = weeks[op.weekIndex];
  if (!week) return plan;
  const dayIndex = week.days.findIndex((d) => d.dayOfWeek === op.dayOfWeek);
  if (dayIndex === -1) return plan;
  const day = week.days[dayIndex]!;

  if (op.action.type === "replace_session") {
    const newSession: SessionPrescription = {
      sessionType: op.action.sessionType as SessionPrescription["sessionType"],
      title: op.action.title,
      warmup: day.session.warmup, // preserve existing warm-up
      main: op.action.main.map((m) => {
        const row: SessionPrescription["main"][number] = {
          name: m.name,
          sets: m.sets,
          reps: m.reps,
        };
        if (m.weightLb !== undefined) row.weightLb = m.weightLb;
        if (m.weightDescriptor !== undefined) row.weightDescriptor = m.weightDescriptor;
        if (m.notes !== undefined) row.notes = m.notes;
        return row;
      }),
      cooldown: day.session.cooldown,
      notes: op.action.note
        ? [...(day.session.notes ?? []), op.action.note]
        : day.session.notes,
    };
    week.days[dayIndex] = { ...day, session: newSession };
  } else if (op.action.type === "add_note") {
    week.days[dayIndex] = {
      ...day,
      session: {
        ...day.session,
        notes: [...(day.session.notes ?? []), op.action.text],
      },
    };
  } else if (op.action.type === "rest_day") {
    week.days[dayIndex] = {
      ...day,
      session: {
        sessionType: "rest",
        title: "Rest day (chat edit)",
        warmup: [],
        main: [
          {
            name: "Rest — adjusted via chat",
            sets: 1,
            reps: 1,
            notes: op.action.reason ?? "",
          },
        ],
        cooldown: [],
        ...(op.action.reason ? { notes: [op.action.reason] } : {}),
      },
    };
  }

  return { ...plan, weeks: weeks as WeekPlan[] };
}

function summarizeEdits(ops: readonly EditOp[]): string {
  if (!ops.length) return "(no changes applied)";
  return ops
    .map((op) => {
      const day = `Wk ${op.weekIndex + 1} ${DOW[op.dayOfWeek] ?? `?`}`;
      if (op.action.type === "replace_session") {
        return `${day}: → ${op.action.title}`;
      }
      if (op.action.type === "add_note") {
        return `${day}: + note (${op.action.text.slice(0, 60)}${op.action.text.length > 60 ? "…" : ""})`;
      }
      return `${day}: → rest`;
    })
    .join("\n");
}

export async function loadChatHistory(planId: string) {
  return db.query.planChatMessages.findMany({
    where: eq(schema.planChatMessages.planId, planId),
    orderBy: [asc(schema.planChatMessages.createdAt)],
  });
}

export async function postChatMessage(args: {
  userId: string;
  planId: string;
  message: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId, planId, message } = args;
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 2000) {
    return { ok: false, error: "Message must be 1-2000 characters" };
  }

  const planRow = await db.query.plans.findFirst({
    where: and(eq(schema.plans.id, planId), eq(schema.plans.userId, userId)),
  });
  if (!planRow) return { ok: false, error: "Plan not found" };
  const plan = planRow.payload as Plan;

  const history = await loadChatHistory(planId);
  const historyForGroq = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  await db.insert(schema.planChatMessages).values({
    planId,
    userId,
    role: "user",
    content: trimmed,
  });

  const response = await generateChatResponse({
    plan,
    userMessage: trimmed,
    history: historyForGroq,
    userId,
  });

  if (!response) {
    await db.insert(schema.planChatMessages).values({
      planId,
      userId,
      role: "assistant",
      content:
        "I can't reach the AI right now. Try again in a moment, or rephrase your request.",
    });
    return { ok: false, error: "AI unavailable" };
  }

  let nextPlan = plan;
  const applied: EditOp[] = [];
  for (const op of response.edits) {
    const before = nextPlan;
    nextPlan = applyEdit(nextPlan, op);
    if (nextPlan !== before) applied.push(op);
  }

  if (applied.length > 0) {
    await db
      .update(schema.plans)
      .set({ payload: nextPlan })
      .where(eq(schema.plans.id, planId));
    logger.info({ userId, planId, count: applied.length }, "chat applied edits");
  }

  const fullContent =
    applied.length > 0
      ? `${response.reply}\n\nChanges applied:\n${summarizeEdits(applied)}`
      : response.reply;

  await db.insert(schema.planChatMessages).values({
    planId,
    userId,
    role: "assistant",
    content: fullContent,
    appliedEdits: applied.length ? applied : null,
  });

  return { ok: true };
}
