import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export type WeightLogEntry = {
  id: string;
  weightLb: number;
  recordedAt: string; // ISO
  notes: string | null;
};

export async function loadWeightLog(args: {
  userId: string;
  planId?: string;
  limit?: number;
}): Promise<WeightLogEntry[]> {
  const { userId, planId, limit = 60 } = args;
  const rows = await db.query.weightLogs.findMany({
    where: planId
      ? and(eq(schema.weightLogs.userId, userId), eq(schema.weightLogs.planId, planId))
      : eq(schema.weightLogs.userId, userId),
    orderBy: [asc(schema.weightLogs.recordedAt)],
    limit,
  });
  return rows.map((r) => ({
    id: r.id,
    weightLb: r.weightLb,
    recordedAt: r.recordedAt.toISOString(),
    notes: r.notes,
  }));
}

export async function logWeight(args: {
  userId: string;
  planId: string | null;
  weightLb: number;
  recordedAt?: Date;
  notes?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { userId, planId, weightLb, notes } = args;
  if (!Number.isInteger(weightLb) || weightLb < 60 || weightLb > 600) {
    return { ok: false, error: "Weight must be an integer between 60 and 600 lb" };
  }
  const [row] = await db
    .insert(schema.weightLogs)
    .values({
      userId,
      planId: planId ?? null,
      weightLb,
      ...(args.recordedAt ? { recordedAt: args.recordedAt } : {}),
      ...(notes ? { notes } : {}),
    })
    .returning({ id: schema.weightLogs.id });
  if (!row) return { ok: false, error: "Could not save" };
  return { ok: true, id: row.id };
}

export async function deleteWeightEntry(args: {
  userId: string;
  entryId: string;
}): Promise<void> {
  await db
    .delete(schema.weightLogs)
    .where(
      and(
        eq(schema.weightLogs.id, args.entryId),
        eq(schema.weightLogs.userId, args.userId),
      ),
    );
}
