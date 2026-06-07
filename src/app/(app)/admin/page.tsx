import Link from "next/link";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isOwnerEmail, requireAdmin } from "@/lib/auth";
import {
  deleteUserAction,
  promoteToAdminAction,
  setUserDisabledAction,
} from "./actions";

export default async function AdminPage() {
  const { user: admin } = await requireAdmin();

  const users = await db.query.users.findMany({
    orderBy: [desc(schema.users.lastSeenAt), desc(schema.users.createdAt)],
  });

  // Quick per-user plan + workout counts via subqueries
  const planCounts = await db
    .select({
      userId: schema.plans.userId,
      total: sql<number>`count(*)::int`,
      active: sql<number>`sum(case when ${schema.plans.active} then 1 else 0 end)::int`,
    })
    .from(schema.plans)
    .groupBy(schema.plans.userId);
  const planMap = new Map(
    planCounts.map((c) => [c.userId, { total: c.total, active: c.active }]),
  );

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const groq24h = await db
    .select({
      userId: schema.groqCalls.userId,
      calls: sql<number>`count(*)::int`,
      inputTokens: sql<number>`coalesce(sum(${schema.groqCalls.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${schema.groqCalls.outputTokens}), 0)::int`,
    })
    .from(schema.groqCalls)
    .where(gte(schema.groqCalls.createdAt, since24h))
    .groupBy(schema.groqCalls.userId);
  const groq24hMap = new Map(groq24h.map((g) => [g.userId, g]));

  // Top-line stats
  const [{ totalCalls = 0 } = {}] = await db
    .select({ totalCalls: sql<number>`count(*)::int` })
    .from(schema.groqCalls);
  const [{ totalInputTokens = 0, totalOutputTokens = 0 } = {}] = await db
    .select({
      totalInputTokens: sql<number>`coalesce(sum(${schema.groqCalls.inputTokens}), 0)::int`,
      totalOutputTokens: sql<number>`coalesce(sum(${schema.groqCalls.outputTokens}), 0)::int`,
    })
    .from(schema.groqCalls);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="border-b border-[var(--color-line)] pb-4">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-ink-3)]">
          Admin · Owner panel
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">User management</h1>
        <p className="mt-1 text-xs text-[var(--color-ink-3)]">
          Signed in as <span className="font-mono">{admin.email}</span> (admin)
        </p>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Users" value={users.length} />
        <Stat label="Active accounts" value={users.filter((u) => !u.disabled).length} />
        <Stat label="Groq calls" value={totalCalls} />
        <Stat
          label="Groq tokens (in+out)"
          value={(totalInputTokens + totalOutputTokens).toLocaleString()}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
          Users
        </h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--color-line)] bg-white">
          <table className="w-full min-w-[820px] text-[11px]">
            <thead className="border-b border-[var(--color-line)] text-left text-[var(--color-ink-3)]">
              <tr>
                <th className="px-3 py-2 font-normal">Email</th>
                <th className="px-3 py-2 font-normal">Role</th>
                <th className="px-3 py-2 font-normal">Joined</th>
                <th className="px-3 py-2 font-normal">Last seen</th>
                <th className="px-3 py-2 font-normal">Plans</th>
                <th className="px-3 py-2 font-normal">Groq 24h</th>
                <th className="px-3 py-2 font-normal">Groq total</th>
                <th className="px-3 py-2 font-normal">State</th>
                <th className="px-3 py-2 font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === admin.id;
                const isOwner = isOwnerEmail(u.email);
                const plan = planMap.get(u.id);
                const g24h = groq24hMap.get(u.id);
                return (
                  <tr key={u.id} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="px-3 py-2">
                      <div className="font-mono text-[var(--color-ink)]">{u.email}</div>
                      <div className="text-[10px] text-[var(--color-ink-3)]">{u.name ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2">
                      <RolePill role={u.role} />
                    </td>
                    <td className="px-3 py-2 font-mono text-[var(--color-ink-3)]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-[var(--color-ink-3)]">
                      {u.lastSeenAt ? relTime(u.lastSeenAt) : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {plan ? `${plan.total} (${plan.active} active)` : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {g24h ? `${g24h.calls} / ${(g24h.inputTokens + g24h.outputTokens).toLocaleString()} tok` : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {u.groqCallCount} / {(u.groqInputTokens + u.groqOutputTokens).toLocaleString()} tok
                    </td>
                    <td className="px-3 py-2">
                      {u.disabled ? (
                        <span className="rounded bg-[var(--color-danger)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
                          locked
                        </span>
                      ) : (
                        <span className="rounded bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-accent)]">
                          active
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1">
                        {!isOwner && !isSelf && (
                          <form action={setUserDisabledAction}>
                            <input type="hidden" name="userId" value={u.id} />
                            <input type="hidden" name="disabled" value={String(!u.disabled)} />
                            <button
                              type="submit"
                              className="rounded border border-[var(--color-line)] px-2 py-0.5 text-[10px] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                            >
                              {u.disabled ? "Unlock" : "Lock"}
                            </button>
                          </form>
                        )}
                        {!isOwner && !isSelf && u.role === "user" && (
                          <form action={promoteToAdminAction}>
                            <input type="hidden" name="userId" value={u.id} />
                            <input type="hidden" name="role" value="admin" />
                            <button
                              type="submit"
                              className="rounded border border-[var(--color-line)] px-2 py-0.5 text-[10px] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                            >
                              Make admin
                            </button>
                          </form>
                        )}
                        {!isOwner && !isSelf && u.role === "admin" && (
                          <form action={promoteToAdminAction}>
                            <input type="hidden" name="userId" value={u.id} />
                            <input type="hidden" name="role" value="user" />
                            <button
                              type="submit"
                              className="rounded border border-[var(--color-line)] px-2 py-0.5 text-[10px] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                            >
                              Demote
                            </button>
                          </form>
                        )}
                        {!isOwner && !isSelf && (
                          <form
                            action={deleteUserAction}
                            // Server actions can't show a confirm() dialog server-side.
                            // The button's "Delete" label is intentionally explicit.
                          >
                            <input type="hidden" name="userId" value={u.id} />
                            <button
                              type="submit"
                              className="rounded border border-[var(--color-danger)] px-2 py-0.5 text-[10px] text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white"
                            >
                              Delete
                            </button>
                          </form>
                        )}
                        {isOwner && (
                          <span className="text-[10px] text-[var(--color-ink-3)]">owner</span>
                        )}
                        {isSelf && !isOwner && (
                          <span className="text-[10px] text-[var(--color-ink-3)]">you</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-8 text-xs text-[var(--color-ink-3)]">
        Lock/unlock takes effect at the user's next request (auth re-checks role &
        disabled on every server render via getAuthAndUser).
        <br />
        <Link href="/dashboard" className="text-[var(--color-accent)] hover:underline">
          ← back to app
        </Link>
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-white p-4">
      <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-3)]">
        {label}
      </p>
      <div className="mt-1 font-mono text-2xl font-semibold text-[var(--color-ink)]">{value}</div>
    </div>
  );
}

function RolePill({ role }: { role: string }) {
  if (role === "admin") {
    return (
      <span className="rounded bg-[var(--color-accent)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
        Admin
      </span>
    );
  }
  return (
    <span className="rounded bg-[var(--color-bg-2)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-ink-3)]">
      User
    </span>
  );
}

function relTime(date: Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  return `${days}d ago`;
}
