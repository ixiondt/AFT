import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { loadWeightLog, type WeightLogEntry } from "@/lib/aft/weight-service";
import {
  ARMY_WHTR_MAX,
  armyBodyFatMaxPct,
  tapeBodyFatPct,
  tapeBodyFatPctMultiSite,
  whtR,
  whtRArmyPass,
  whtRBand,
  whtRBandLabel,
} from "@/lib/aft/body-comp";
import { Callout } from "@/components/ui";
import { logBodyMetricsAction, setHeightAction } from "./actions";

const BAND_COLOR: Record<string, string> = {
  healthy: "var(--color-accent)",
  increased: "var(--color-warn)",
  high: "oklch(0.6 0.18 35)",
  very_high: "var(--color-danger)",
};

export default async function BodyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const profile = await db.query.profiles.findFirst({
    where: eq(schema.profiles.userId, session.user.id),
  });
  const log = await loadWeightLog({ userId: session.user.id });
  const latest = log[log.length - 1];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="border-b border-[var(--color-line)] pb-4">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-ink-3)]">
          Body composition
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Height &amp; Weight</h1>
        <p className="mt-1 text-xs text-[var(--color-ink-3)]">
          Waist-to-Height Ratio (WHtR) is the Army body-composition standard.
          Weight and legacy tape body-fat % are tracked for reference.
        </p>
      </header>

      <Callout tone="info" title="WHtR is now the only standard" className="mt-5">
        Per the Jan 2026 directive, a waist-to-height ratio{" "}
        <span className="font-mono">&lt; {ARMY_WHTR_MAX}</span> is the sole
        authorized body-composition test. There is no tape / DXA / InBody
        appeal, and no AFT-score (465+) exemption — the tape body-fat % below is
        kept for reference and historical worksheets only.
      </Callout>

      {!profile?.heightIn ? (
        <HeightSetup />
      ) : (
        <>
          <HeightEditor currentHeight={profile.heightIn} />
          <CurrentSummary
            profile={profile}
            latest={latest ?? null}
          />
        </>
      )}

      {profile?.heightIn && (
        <LogForm
          latest={latest ?? null}
          sex={profile.sex}
        />
      )}

      {profile?.heightIn && latest && (
        <ExportSection sex={profile.sex} />
      )}

      <History log={log} profile={profile ?? null} />

      <footer className="mt-12 border-t border-[var(--color-line)] pt-4 text-xs text-[var(--color-ink-3)]">
        WHtR (waist ÷ height) is the sole Army body-composition standard —
        pass is <span className="font-mono">&lt; {ARMY_WHTR_MAX}</span>. The tape
        body-fat % is the legacy single-site formula (ALARACT 053/2024), kept
        for reference and DA 5500/5501 worksheets only:
        <br />
        Male: <span className="font-mono">%BF = -26.97 - 0.12·weight + 1.99·abdomen</span>
        <br />
        Female: <span className="font-mono">%BF = -9.15 - 0.015·weight + 1.27·abdomen</span>
        <br />
        Height isn't in the BF% formula — only WHtR uses it. The finer WHtR
        health-risk bands are WHO / NIH (PMC5118501), separate from the 0.55
        pass line. If you log neck (and hip, for women), the history table also
        surfaces the legacy Hodgdon-Beckett multi-site number for comparison.
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
            {currentHeight}″
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
          Used for WHtR + BF% calculations.
        </p>
      </form>
    </details>
  );
}

function HeightSetup() {
  return (
    <section className="mt-6 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-2)] p-5">
      <h2 className="text-sm font-semibold text-[var(--color-ink)]">
        First, what's your height?
      </h2>
      <p className="mt-1 text-xs text-[var(--color-ink-3)]">
        Required to compute WHtR and tape-test body fat %.
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
  // WHtR waist is measured at the navel — the same site as the Army's
  // abdominal circumference — so fall back to abdomen when waist isn't logged
  // separately. Applies to both sexes now that WHtR is the sole standard.
  const waistOrAbdomen =
    latest?.measurements?.waistIn ?? latest?.measurements?.abdomenIn;
  const ratio = whtR(waistOrAbdomen, heightIn);
  const band = ratio !== null ? whtRBand(ratio) : null;
  const armyPass = ratio !== null ? whtRArmyPass(ratio) : null;
  const bf = latest
    ? tapeBodyFatPct({
        sex: profile.sex,
        weightLb: latest.weightLb,
        measurements: latest.measurements ?? {},
      })
    : null;
  const bfMax = armyBodyFatMaxPct(profile.age, profile.sex);

  return (
    <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          Height {heightIn || "—"}″
        </p>
      </Card>

      <Card title="WHtR — Army standard">
        {ratio !== null && band !== null && armyPass !== null ? (
          <>
            <div
              className="font-mono text-3xl font-bold"
              style={{
                color: armyPass ? "var(--color-accent)" : "var(--color-danger)",
              }}
            >
              {ratio.toFixed(2)}
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
              Army standard &lt; {ARMY_WHTR_MAX}
            </p>
            <p className="text-[10px]" style={{ color: BAND_COLOR[band] }}>
              {whtRBandLabel(band)} (health)
            </p>
          </>
        ) : (
          <>
            <NoData />
            <p className="mt-1 text-[10px] text-[var(--color-ink-3)]">
              Log waist at navel
            </p>
          </>
        )}
      </Card>

      <Card title="Body fat % — legacy">
        {bf !== null ? (
          <>
            <div className="font-mono text-3xl font-bold text-[var(--color-ink-2)]">
              {bf}%
            </div>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
              Ref only · old max {bfMax}% (age {profile.age}, {profile.sex})
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--color-ink-3)]">
              Tape test — no longer a standard
            </p>
          </>
        ) : (
          <>
            <NoData />
            <p className="mt-1 text-[10px] text-[var(--color-ink-3)]">
              Log abdomen at navel
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

function LogForm({
  latest,
  sex,
}: {
  latest: WeightLogEntry | null;
  sex: "MC" | "F";
}) {
  const prefill = latest?.measurements ?? {};

  return (
    <section className="mt-6 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-2)] p-5">
      <h2 className="text-sm font-semibold text-[var(--color-ink)]">
        Log today's numbers
      </h2>
      <p className="mt-1 text-xs text-[var(--color-ink-3)]">
        Fill what you measured. Earlier values are pre-filled.
      </p>
      <form action={logBodyMetricsAction} className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field
            name="weightLb"
            label="Weight (lb)"
            defaultValue={latest?.weightLb}
            min={60}
            max={600}
            required
          />
          <Field
            name="abdomenIn"
            label="Waist at navel (in)"
            defaultValue={prefill.abdomenIn}
            step={0.1}
            min={20}
            max={70}
            hint="Drives WHtR — the Army standard"
          />
        </div>
        <details className="text-xs text-[var(--color-ink-3)]">
          <summary className="cursor-pointer hover:text-[var(--color-ink-2)]">
            Optional: log waist {sex === "F" ? "+ hip + neck" : "+ neck"} for the
            legacy multi-site number
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field
              name="waistIn"
              label="Waist (in)"
              defaultValue={prefill.waistIn}
              step={0.1}
              min={20}
              max={70}
            />
            <Field
              name="neckIn"
              label="Neck (in)"
              defaultValue={prefill.neckIn}
              step={0.1}
              min={10}
              max={25}
            />
            {sex === "F" && (
              <Field
                name="hipIn"
                label="Hip (in)"
                defaultValue={prefill.hipIn}
                step={0.1}
                min={25}
                max={80}
              />
            )}
          </div>
        </details>
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

function ExportSection({ sex }: { sex: "MC" | "F" }) {
  const formName = sex === "MC" ? "DA 5500" : "DA 5501";
  return (
    <section className="mt-6 rounded-lg border border-[var(--color-line)] bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-ink)]">
            Export Army Body Fat Worksheet ({formName})
          </h2>
          <p className="mt-1 text-xs text-[var(--color-ink-3)]">
            Generates the official {formName} pre-filled with your most recent
            log + the legacy single-site tape calculation. WHtR is the current
            standard; use this only if your unit still requires the worksheet.
          </p>
        </div>
      </div>
      <form
        action="/api/body/da-form"
        method="GET"
        className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
      >
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
            Rank (optional)
          </span>
          <input
            type="text"
            name="rank"
            maxLength={10}
            placeholder="SGT"
            className="mt-0.5 block w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--color-accent)] focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
            Prepared by (optional)
          </span>
          <input
            type="text"
            name="prepared_by"
            maxLength={60}
            placeholder="LAST, FIRST"
            className="mt-0.5 block w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--color-accent)] focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
            Preparer rank
          </span>
          <input
            type="text"
            name="prepared_by_rank"
            maxLength={10}
            placeholder="SFC"
            className="mt-0.5 block w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--color-accent)] focus:outline-none"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] hover:opacity-90"
          >
            Download {formName}
          </button>
        </div>
      </form>
    </section>
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
  const isMale = profile?.sex === "MC";

  return (
    <section className="mt-8">
      <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
        History
      </h2>
      <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--color-line)] bg-white">
        <table className="w-full min-w-[480px] text-[11px]">
          <thead className="border-b border-[var(--color-line)] text-left text-[var(--color-ink-3)]">
            <tr>
              <th className="px-3 py-2 font-normal">Date</th>
              <th className="px-3 py-2 font-normal">Weight</th>
              <th className="px-3 py-2 font-normal">Waist</th>
              <th className="px-3 py-2 font-normal">WHtR</th>
              <th className="px-3 py-2 font-normal">BF % (ref)</th>
              {isMale && <th className="px-3 py-2 font-normal">BF % (multi-site)</th>}
              <th className="px-3 py-2 font-normal">Note</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => {
              const heightIn = profile?.heightIn ?? 0;
              const waistOrAbdomen =
                e.measurements?.waistIn ?? e.measurements?.abdomenIn;
              const ratio = whtR(waistOrAbdomen, heightIn);
              const bf = profile
                ? tapeBodyFatPct({
                    sex: profile.sex,
                    weightLb: e.weightLb,
                    measurements: e.measurements ?? {},
                  })
                : null;
              const bfLegacy = profile
                ? tapeBodyFatPctMultiSite({
                    sex: profile.sex,
                    heightIn,
                    measurements: e.measurements ?? {},
                  })
                : null;
              return (
                <tr key={e.id} className="border-b border-[var(--color-line)] last:border-0">
                  <td className="px-3 py-1.5 font-mono">
                    {new Date(e.recordedAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-1.5 font-mono">{e.weightLb}</td>
                  <td className="px-3 py-1.5 font-mono">{waistOrAbdomen ?? "—"}</td>
                  <td className="px-3 py-1.5 font-mono">
                    {ratio !== null ? ratio.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-1.5 font-mono">
                    {bf !== null ? `${bf}%` : "—"}
                  </td>
                  {isMale && (
                    <td className="px-3 py-1.5 font-mono text-[var(--color-ink-3)]">
                      {bfLegacy !== null ? `${bfLegacy}%` : "—"}
                    </td>
                  )}
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
