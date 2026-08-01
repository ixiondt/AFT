import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { loadWeightLog, type WeightLogEntry } from "@/lib/aft/weight-service";
import {
  ARMY_WHTR_MAX,
  truncateWhtR3,
  whtR,
  whtRArmyPass,
  whtRBand,
  whtRBandLabel,
} from "@/lib/aft/body-comp";
import { evaluationEntry } from "@/lib/aft/abcp-paperwork";
import { Callout } from "@/components/ui";
import { CopyButton } from "./copy-button";
import { logBodyMetricsAction, setHeightAction } from "./actions";

const BAND_COLOR: Record<string, string> = {
  healthy: "var(--color-accent)",
  increased: "var(--color-warn)",
  high: "oklch(0.6 0.18 35)",
  very_high: "var(--color-danger)",
};

/** The recorded standard, shown to three decimals ("0.550"). */
const STANDARD = ARMY_WHTR_MAX.toFixed(3);

/** Waist logged at the navel — falls back to the legacy abdomen field. */
function waistOf(m: WeightLogEntry["measurements"]): number | undefined {
  return m?.waistIn ?? m?.abdomenIn;
}

export default async function BodyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const profile = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, session.user.id),
  });
  const log = await loadWeightLog({ userId: session.user.id });
  const latest = log[log.length - 1];

  const heightIn = profile?.heightIn ?? 0;
  const latestRatio = whtR(waistOf(latest?.measurements ?? null), heightIn);
  const latestWhtr = latestRatio !== null ? truncateWhtR3(latestRatio) : null;
  const latestPass = latestRatio !== null ? whtRArmyPass(latestRatio) : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="border-b border-[var(--color-line)] pb-4">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-ink-3)]">
          Body composition
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Height &amp; Weight</h1>
        <p className="mt-1 text-xs text-[var(--color-ink-3)]">
          Waist-to-Height Ratio (WHtR) is the Army&rsquo;s sole body-composition
          standard. Weight is tracked for your own reference.
        </p>
      </header>

      <Callout tone="info" title="WHtR is the only standard" className="mt-5">
        Per Army Directive 2026-13 (effective 1 Jul 2026), a waist-to-height ratio{" "}
        <span className="font-mono">&lt; {STANDARD}</span> is the sole authorized
        body-composition test. Height/weight tables and the tape body-fat test
        are discontinued — no tape / DXA / InBody appeal and no AFT-score
        exemption. Measured at least twice a year; a ratio of{" "}
        <span className="font-mono">{STANDARD}</span> or greater flags the Soldier
        (flag code K) and enrolls them in the ABCP.
      </Callout>

      {!profile?.heightIn ? (
        <HeightSetup />
      ) : (
        <>
          <HeightEditor currentHeight={profile.heightIn} />
          <CurrentSummary profile={profile} latest={latest ?? null} />
        </>
      )}

      {profile?.heightIn && <LogForm latest={latest ?? null} />}

      {profile?.heightIn && latest && <ExportSection />}

      {profile?.heightIn && (
        <PaperworkSection whtr={latestWhtr} compliant={latestPass} />
      )}

      <History log={log} profile={profile ?? null} />

      <footer className="mt-12 border-t border-[var(--color-line)] pt-4 text-xs text-[var(--color-ink-3)]">
        WHtR = average waist ÷ height, both in inches. Waist is measured at the
        navel three times, each rounded <em>down</em> to the nearest 0.5&Prime;;
        height is rounded to the nearest 0.5&Prime;. The recorded ratio is{" "}
        <em>truncated</em> to three decimals (digits past the third are dropped,
        not rounded): <span className="font-mono">0.549888 → 0.549</span>.{" "}
        <span className="font-mono">&lt; {STANDARD}</span> passes;{" "}
        <span className="font-mono">≥ {STANDARD}</span> fails. If the initial
        ratio is <span className="font-mono">≥ {STANDARD}</span>, a confirmation
        measurement by a different team is taken the same duty day before any
        command action. The finer WHtR health-risk bands are WHO / NIH
        (PMC5118501) context, separate from the {STANDARD} pass line.
      </footer>
    </main>
  );
}

function HeightEditor({ currentHeight }: { currentHeight: number }) {
  return (
    <details className="mt-4 rounded-md border border-[var(--color-line)] bg-[var(--color-bg-2)]">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-2 text-xs text-[var(--color-ink-2)] hover:text-[var(--color-ink)] [&::-webkit-details-marker]:hidden">
        <span>
          Height:{" "}
          <span className="font-mono text-sm text-[var(--color-ink)]">
            {currentHeight}&Prime;
          </span>
        </span>
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-accent)]">
          Edit
        </span>
      </summary>
      <form
        action={setHeightAction}
        className="flex flex-wrap items-end gap-2 border-t border-[var(--color-line)] px-4 py-3"
      >
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
            Height (inches)
          </span>
          <input
            type="number"
            name="heightIn"
            min={48}
            max={96}
            step={0.5}
            required
            defaultValue={currentHeight}
            className="mt-0.5 block w-24 rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--color-accent)] focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-[var(--color-accent-fg)] hover:opacity-90"
        >
          Save
        </button>
        <p className="ml-auto text-[10px] text-[var(--color-ink-3)]">
          Used for the WHtR calculation.
        </p>
      </form>
    </details>
  );
}

function HeightSetup() {
  return (
    <section className="mt-6 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-2)] p-5">
      <h2 className="text-sm font-semibold text-[var(--color-ink)]">
        First, what&rsquo;s your height?
      </h2>
      <p className="mt-1 text-xs text-[var(--color-ink-3)]">
        Required to compute your WHtR.
      </p>
      <form action={setHeightAction} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
            Height (inches)
          </span>
          <input
            type="number"
            name="heightIn"
            min={48}
            max={96}
            step={0.5}
            required
            autoFocus
            placeholder="70"
            className="mt-0.5 block w-24 rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--color-accent)] focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-[var(--color-accent-fg)] hover:opacity-90"
        >
          Save height
        </button>
      </form>
    </section>
  );
}

function CurrentSummary({
  profile,
  latest,
}: {
  profile: { age: number; sex: "MC" | "F"; heightIn: number | null };
  latest: WeightLogEntry | null;
}) {
  const heightIn = profile.heightIn ?? 0;
  const ratio = whtR(waistOf(latest?.measurements ?? null), heightIn);
  const band = ratio !== null ? whtRBand(ratio) : null;
  const armyPass = ratio !== null ? whtRArmyPass(ratio) : null;
  const recorded = ratio !== null ? truncateWhtR3(ratio).toFixed(3) : null;

  return (
    <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card title="Weight">
        {latest ? (
          <div className="font-mono text-3xl font-bold text-[var(--color-ink)]">
            {latest.weightLb}
            <span className="ml-1 text-sm font-normal text-[var(--color-ink-3)]">lb</span>
          </div>
        ) : (
          <NoData />
        )}
        <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
          Height {heightIn || "—"}&Prime;
        </p>
      </Card>

      <Card title="WHtR — Army standard">
        {recorded !== null && band !== null && armyPass !== null ? (
          <>
            <div
              className="font-mono text-3xl font-bold"
              style={{
                color: armyPass ? "var(--color-accent)" : "var(--color-danger)",
              }}
            >
              {recorded}
            </div>
            <p
              className="mt-1 text-[10px] font-semibold uppercase tracking-wider"
              style={{
                color: armyPass ? "var(--color-accent)" : "var(--color-danger)",
              }}
            >
              {armyPass ? "Pass" : "Fail — flag / ABCP"}
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--color-ink-3)]">
              Army standard &lt; {STANDARD}
              {!armyPass && " · confirm same day (different team)"}
            </p>
            <p className="text-[10px]" style={{ color: BAND_COLOR[band] }}>
              {whtRBandLabel(band)} (health)
            </p>
          </>
        ) : (
          <>
            <NoData />
            <p className="mt-1 text-[10px] text-[var(--color-ink-3)]">
              Log waist at the navel
            </p>
          </>
        )}
      </Card>
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-white p-4">
      <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-3)]">
        {title}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function NoData() {
  return (
    <div className="font-mono text-3xl font-bold text-[var(--color-ink-3)]">—</div>
  );
}

function LogForm({ latest }: { latest: WeightLogEntry | null }) {
  const prefill = latest?.measurements ?? {};
  const readings = prefill.waistReadings ?? [];
  const singleWaist = waistOf(prefill);

  return (
    <section className="mt-6 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-2)] p-5">
      <h2 className="text-sm font-semibold text-[var(--color-ink)]">
        Log today&rsquo;s numbers
      </h2>
      <p className="mt-1 text-xs text-[var(--color-ink-3)]">
        Waist is measured at the navel three times (each rounded down to the
        nearest 0.5&Prime;). Earlier values are pre-filled.
      </p>
      <form action={logBodyMetricsAction} className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field
            name="weightLb"
            label="Weight (lb)"
            defaultValue={latest?.weightLb}
            min={60}
            max={600}
            required
          />
          <Field
            name="waist1"
            label="Waist #1 (in)"
            defaultValue={readings[0] ?? singleWaist}
            step={0.5}
            min={20}
            max={70}
            hint="At the navel"
          />
          <Field
            name="waist2"
            label="Waist #2 (in)"
            defaultValue={readings[1]}
            step={0.5}
            min={20}
            max={70}
          />
          <Field
            name="waist3"
            label="Waist #3 (in)"
            defaultValue={readings[2]}
            step={0.5}
            min={20}
            max={70}
          />
        </div>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
            Notes (optional)
          </span>
          <input
            type="text"
            name="notes"
            maxLength={200}
            placeholder="post-run, fasted, etc."
            className="mt-0.5 block w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--color-accent)] focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] hover:opacity-90"
        >
          Log
        </button>
      </form>
    </section>
  );
}

function Field({
  name,
  label,
  defaultValue,
  min,
  max,
  step,
  required,
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
        {label}
      </span>
      <input
        type="number"
        name={name}
        defaultValue={defaultValue ?? ""}
        min={min}
        max={max}
        step={step}
        required={required}
        className="mt-0.5 block w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--color-accent)] focus:outline-none"
      />
      {hint && (
        <span className="mt-0.5 block text-[10px] text-[var(--color-ink-3)]">
          {hint}
        </span>
      )}
    </label>
  );
}

function ExportSection() {
  return (
    <section className="mt-6 rounded-lg border border-[var(--color-line)] bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-[var(--color-ink)]">
          Export DA Form 5500 (Jul 2026)
        </h2>
        <p className="mt-1 text-xs text-[var(--color-ink-3)]">
          Generates the official Army Body Composition Screening and Assessment
          Worksheet pre-filled with your most recent WHtR measurement. DA 5501 is
          rescinded — one form for all Soldiers.
        </p>
      </div>
      <form
        action="/api/body/da-form"
        method="GET"
        className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <TextInput name="rank" label="Rank (optional)" placeholder="SGT" maxLength={10} />
        <TextInput name="remarks" label="Remarks (optional)" placeholder="…" maxLength={120} />
        <TextInput name="prepared_by" label="Prepared by (optional)" placeholder="LAST, FIRST" maxLength={60} />
        <TextInput name="prepared_by_rank" label="Preparer rank" placeholder="SFC" maxLength={10} />
        <TextInput name="approved_by" label="Approved by (optional)" placeholder="LAST, FIRST" maxLength={60} />
        <TextInput name="approved_by_rank" label="Approver rank" placeholder="MAJ" maxLength={10} />
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] hover:opacity-90"
          >
            Download DA 5500
          </button>
        </div>
      </form>
    </section>
  );
}

function TextInput({
  name,
  label,
  placeholder,
  maxLength,
}: {
  name: string;
  label: string;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
        {label}
      </span>
      <input
        type="text"
        name={name}
        maxLength={maxLength}
        placeholder={placeholder}
        className="mt-0.5 block w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--color-accent)] focus:outline-none"
      />
    </label>
  );
}

function PaperworkSection({
  whtr,
  compliant,
}: {
  whtr: number | null;
  compliant: boolean | null;
}) {
  return (
    <section className="mt-6 rounded-lg border border-[var(--color-line)] bg-white p-5">
      <h2 className="text-sm font-semibold text-[var(--color-ink)]">
        ABCP enrollment paperwork
      </h2>
      <p className="mt-1 text-xs text-[var(--color-ink-3)]">
        A Soldier with a WHtR of {STANDARD} or greater is flagged (code K) and
        enrolled in the ABCP. Generate the counseling, acknowledgement, and
        medical-evaluation memos below — blank fields print as placeholders you
        fill in and sign.
      </p>

      <EvaluationEntryBlock whtr={whtr} compliant={compliant} />

      <details className="mt-4 rounded-md border border-[var(--color-line)] bg-[var(--color-bg-2)]">
        <summary className="cursor-pointer px-4 py-2 text-xs text-[var(--color-ink-2)] hover:text-[var(--color-ink)]">
          Enrollment memos (counseling · acknowledgement · medical request)
        </summary>
        <form method="GET" className="border-t border-[var(--color-line)] p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextInput name="office_symbol" label="Office symbol" placeholder="ABC-DE-F" maxLength={40} />
            <TextInput name="unit" label="Unit" placeholder="HHD, 1-1 IN" maxLength={80} />
            <TextInput name="org_name" label="Organization" placeholder="1st Battalion, 1st Infantry" maxLength={80} />
            <TextInput name="org_address" label="Street address" placeholder="1 Army Way" maxLength={80} />
            <TextInput name="org_city_state_zip" label="City, State ZIP" placeholder="Fort X, ST 00000" maxLength={80} />
            <TextInput name="soldier_rank" label="Soldier rank" placeholder="SGT" maxLength={10} />
            <TextInput name="soldier_branch" label="Soldier branch" placeholder="IN / USA" maxLength={10} />
            <TextInput name="dodid" label="DODID (medical)" placeholder="0000000000" maxLength={12} />
            <TextInput name="commander_name" label="Commander name" placeholder="LAST, FIRST" maxLength={60} />
            <TextInput name="commander_rank" label="Commander rank, branch" placeholder="MAJ, MI" maxLength={30} />
            <TextInput name="commander_title" label="Commander title" placeholder="Commanding" maxLength={40} />
            <TextInput name="poc_name" label="POC name (medical)" placeholder="SFC LAST, FIRST" maxLength={60} />
            <TextInput name="poc_email" label="POC email (medical)" placeholder="name@army.mil" maxLength={80} />
            <TextInput name="poc_phone" label="POC phone (medical)" placeholder="000-000-0000" maxLength={20} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <MemoButton type="counseling" label="Commander's counseling" />
            <MemoButton type="acknowledgement" label="Soldier's acknowledgement" />
            <MemoButton type="medical" label="Medical eval request" />
          </div>
        </form>
      </details>
    </section>
  );
}

function MemoButton({ type, label }: { type: string; label: string }) {
  return (
    <button
      type="submit"
      formAction={`/api/body/memo/${type}`}
      className="rounded-lg border border-[var(--color-accent)] px-3 py-2 text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-fg)]"
    >
      {label}
    </button>
  );
}

function EvaluationEntryBlock({
  whtr,
  compliant,
}: {
  whtr: number | null;
  compliant: boolean | null;
}) {
  const entry = evaluationEntry({ whtr, compliant });
  const block = `HEIGHT: ${entry.height}   WEIGHT: ${entry.weight}   AR 600-9: ${entry.compliance}\n${entry.comment}`;

  return (
    <div className="mt-4 rounded-md border border-[var(--color-line)] bg-[var(--color-bg-2)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-3)]">
          OER / NCOER / AER entry (Annex B)
        </p>
        <CopyButton text={block} />
      </div>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-[var(--color-ink)]">
        {block}
      </pre>
      <p className="mt-2 text-[10px] text-[var(--color-ink-3)]">
        Enter <span className="font-mono">99</span> for height and{" "}
        <span className="font-mono">999</span> for weight in Part IV, select{" "}
        <span className="font-mono">{entry.compliance}</span> for AR 600-9
        compliance, and add the WHtR comment. A medical condition may be cited
        for a &ldquo;NO&rdquo; but does not change the entry — WHtR waivers are
        not permitted for evaluations.
      </p>
    </div>
  );
}

function History({
  log,
  profile,
}: {
  log: readonly WeightLogEntry[];
  profile: { age: number; sex: "MC" | "F"; heightIn: number | null } | null;
}) {
  if (!log.length) return null;
  const sorted = [...log].reverse();

  return (
    <section className="mt-8">
      <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
        History
      </h2>
      <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--color-line)] bg-white">
        <table className="w-full min-w-[420px] text-[11px]">
          <thead className="border-b border-[var(--color-line)] text-left text-[var(--color-ink-3)]">
            <tr>
              <th className="px-3 py-2 font-normal">Date</th>
              <th className="px-3 py-2 font-normal">Weight</th>
              <th className="px-3 py-2 font-normal">Waist</th>
              <th className="px-3 py-2 font-normal">WHtR</th>
              <th className="px-3 py-2 font-normal">Standard</th>
              <th className="px-3 py-2 font-normal">Note</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => {
              const heightIn = profile?.heightIn ?? 0;
              const waist = waistOf(e.measurements);
              const ratio = whtR(waist, heightIn);
              const recorded = ratio !== null ? truncateWhtR3(ratio) : null;
              const pass = ratio !== null ? whtRArmyPass(ratio) : null;
              return (
                <tr key={e.id} className="border-b border-[var(--color-line)] last:border-0">
                  <td className="px-3 py-1.5 font-mono">
                    {new Date(e.recordedAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-1.5 font-mono">{e.weightLb}</td>
                  <td className="px-3 py-1.5 font-mono">
                    {waist !== undefined ? waist.toFixed(1) : "—"}
                  </td>
                  <td className="px-3 py-1.5 font-mono">
                    {recorded !== null ? recorded.toFixed(3) : "—"}
                  </td>
                  <td
                    className="px-3 py-1.5 font-mono"
                    style={{
                      color:
                        pass === null
                          ? undefined
                          : pass
                            ? "var(--color-accent)"
                            : "var(--color-danger)",
                    }}
                  >
                    {pass === null ? "—" : pass ? "Pass" : "Fail"}
                  </td>
                  <td className="px-3 py-1.5 text-[var(--color-ink-3)]">{e.notes ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
