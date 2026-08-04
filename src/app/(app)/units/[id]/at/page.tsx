import Link from "next/link";
import { requireUnitAccess } from "@/lib/auth";
import { loadActiveAtPlan } from "@/lib/at/service";
import { loadAtChatHistory } from "@/lib/at/chat-service";
import type { AtDayPlan, AtPlan } from "@/lib/at";
import { readFlash } from "@/lib/flash";
import { SubmitButton } from "../../../../submit-button";
import { generateAtPlanAction } from "./actions";
import { PrintButton } from "./print-button";
import { AtCoachPanel } from "./at-coach-panel";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function AtPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireUnitAccess(id, ["mft"]); // planning is owner/MFT only

  const row = await loadActiveAtPlan(id);
  const plan = (row?.payload as AtPlan | undefined) ?? null;
  const flash = await readFlash();
  const chat = row ? await loadAtChatHistory(row.id) : [];

  const defaultStart = ctx.unit.atStartDate
    ? new Date(ctx.unit.atStartDate).toISOString().slice(0, 10)
    : todayISO();
  const defaultDays = ctx.unit.atDays ?? 14;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href={`/units/${id}`} className="text-xs text-[var(--color-ink-3)] hover:underline">
          ← {ctx.unit.name}
        </Link>
        {plan && (
          <div className="flex items-center gap-2">
            <a
              href={`/api/units/${id}/at/pdf`}
              className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm text-[var(--color-ink-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              Download PDF
            </a>
            <PrintButton />
          </div>
        )}
      </div>

      <header className="mt-2 border-b border-[var(--color-line)] pb-4">
        <p className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
          Annual Training PT
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{ctx.unit.name}</h1>
      </header>

      {flash && (
        <p
          className={
            "mt-4 rounded-md border px-3 py-2 text-sm print:hidden " +
            (flash.type === "error"
              ? "border-[var(--color-danger)] text-[var(--color-danger)]"
              : "border-[var(--color-line)] text-[var(--color-ink-2)]")
          }
        >
          {flash.message}
        </p>
      )}

      <section className="mt-6 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-2)] p-4 print:hidden">
        <h2 className="text-sm font-medium">Generate / regenerate</h2>
        <p className="mt-0.5 text-xs text-[var(--color-ink-3)]">
          Builds ability groups from each soldier's baseline and adapts to profiles.
        </p>
        <form action={generateAtPlanAction} className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="unitId" value={id} />
          <label className="block">
            <span className="block text-xs font-medium text-[var(--color-ink-2)]">AT start</span>
            <input
              type="date"
              name="startDate"
              defaultValue={defaultStart}
              className="mt-1 rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-[var(--color-ink-2)]">Days</span>
            <input
              type="number"
              name="days"
              min={1}
              max={21}
              defaultValue={defaultDays}
              className="mt-1 w-24 rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm"
            />
          </label>
          <SubmitButton
            pendingLabel="Generating…"
            className="rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-[var(--color-accent-fg)] hover:opacity-90"
          >
            {plan ? "Regenerate" : "Generate AT plan"}
          </SubmitButton>
        </form>
      </section>

      {!plan ? (
        <p className="mt-8 text-sm text-[var(--color-ink-3)]">
          No AT plan yet. Add soldiers to the roster, then generate above.
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          {plan.warnings.length > 0 && (
            <section
              className="rounded-xl border-2 p-4 print-keep"
              style={{ borderColor: "var(--color-warn)" }}
            >
              <h2 className="text-sm font-semibold" style={{ color: "var(--color-warn)" }}>
                Before you start
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-[var(--color-ink-2)]">
                {plan.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </section>
          )}

          <AbilityGroups plan={plan} />
          <Schedule plan={plan} />
          <SoldierCards plan={plan} />
          <AtCoachPanel
            unitId={id}
            messages={chat.map((m) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
            }))}
          />
        </div>
      )}
    </main>
  );
}

function AbilityGroups({ plan }: { plan: AtPlan }) {
  return (
    <section className="print-keep">
      <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
        Ability groups
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {plan.groups.map((g) => (
          <div key={g.key} className="rounded-lg border border-[var(--color-line)] bg-white p-3">
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{g.label}</span>
              <span className="font-mono text-xs text-[var(--color-ink-3)]">
                {g.memberIds.length} {g.memberIds.length === 1 ? "soldier" : "soldiers"}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--color-ink-3)]">{g.description}</p>
            {g.prescribedPacePerMileSec !== undefined && (
              <p className="mt-1 text-sm">
                Lead pace: <span className="font-mono">{mmss(g.prescribedPacePerMileSec)}/mi</span>
              </p>
            )}
            {g.modality && (
              <p className="mt-1 text-sm">
                Modality: <span className="font-medium">{g.modality}</span>
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Schedule({ plan }: { plan: AtPlan }) {
  return (
    <section className="print-keep">
      <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
        Daily schedule
      </h2>
      <div className="mt-3 space-y-2">
        {plan.schedule.map((d) => (
          <DayRow key={d.dayIndex} day={d} />
        ))}
      </div>
    </section>
  );
}

function DayRow({ day }: { day: AtDayPlan }) {
  return (
    <div
      className={
        "rounded-lg border p-3 " +
        (day.rest
          ? "border-[var(--color-line)] bg-[var(--color-bg-2)]"
          : "border-[var(--color-line)] bg-white")
      }
    >
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">
          Day {day.dayIndex + 1} · {DOW[day.dayOfWeek]}{" "}
          <span className="font-mono text-xs text-[var(--color-ink-3)]">{day.dateISO}</span>
        </span>
        <span className="text-xs text-[var(--color-ink-2)]">{day.title}</span>
      </div>
      {!day.rest && (
        <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-[var(--color-ink-2)] sm:grid-cols-3">
          <Block label="Preparation" lines={day.preparation} />
          <Block label="Activities" lines={day.activities} />
          <Block label="Recovery" lines={day.recovery} />
        </div>
      )}
      {day.rest && (
        <p className="mt-1 text-xs text-[var(--color-ink-3)]">{day.activities[0]}</p>
      )}
    </div>
  );
}

function Block({ label, lines }: { label: string; lines: readonly string[] }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
        {label}
      </div>
      <ul className="mt-1 space-y-0.5">
        {lines.map((l, i) => (
          <li key={i} className="whitespace-pre-wrap">{l}</li>
        ))}
      </ul>
    </div>
  );
}

function SoldierCards({ plan }: { plan: AtPlan }) {
  if (plan.cards.length === 0) return null;
  return (
    <section className="print-keep">
      <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
        Per-soldier cards
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {plan.cards.map((c) => (
          <div key={c.memberId} className="rounded-lg border border-[var(--color-line)] bg-white p-3">
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{c.displayName}</span>
              <span className="rounded bg-[var(--color-bg-2)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
                {c.abilityGroup}
              </span>
            </div>
            <dl className="mt-2 space-y-1 text-xs text-[var(--color-ink-2)]">
              {c.aftScore && (
                <Line
                  term="AFT"
                  desc={
                    `${c.aftScore.total} pts` +
                    (c.aftScore.profiled
                      ? ` / ${c.aftScore.scoredEventCount} events${c.aftScore.isRecord ? "" : " · diagnostic"}`
                      : "") +
                    ` · ${c.aftScore.pass ? "pass" : "fail"}`
                  }
                />
              )}
              <Line term="Run" desc={c.runPrescription} />
              <Line term="Strength" desc={c.strengthPrescription} />
            </dl>
            {c.accommodations.length > 0 && (
              <div className="mt-2 rounded-md bg-[var(--color-bg-2)] p-2">
                <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-info)]">
                  Accommodations
                </div>
                <ul className="mt-1 space-y-0.5 text-xs text-[var(--color-ink-2)]">
                  {c.accommodations.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            {c.notes.map((n, i) => (
              <p key={i} className="mt-1 text-[11px] text-[var(--color-ink-3)]">
                {n}
              </p>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function Line({ term, desc }: { term: string; desc: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
        {term}
      </dt>
      <dd>{desc}</dd>
    </div>
  );
}

function mmss(total: number): string {
  const t = Math.round(total);
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
