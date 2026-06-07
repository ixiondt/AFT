"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import {
  ageToBracket,
  getRawBounds,
  mmssToSec,
  rawFromPoints,
  scoreEvent,
  secToMmss,
} from "@/lib/scoring";
import type { Event as AftEvent, Sex } from "@/lib/scoring/types";

const EVENT_STEP: Record<AftEvent, number> = {
  MDL: 5,
  HRP: 1,
  SDC: 1,
  PLK: 1,
  "2MR": 1,
};

/* ---------------------------- event helpers ---------------------------- */

const TIME_EVENTS: ReadonlySet<AftEvent> = new Set(["SDC", "PLK", "2MR"]);
function formatRaw(event: AftEvent, raw: number): string {
  if (TIME_EVENTS.has(event)) return secToMmss(raw);
  return String(Math.round(raw));
}
function parseRaw(event: AftEvent, input: string): number | null {
  if (!input.trim()) return null;
  if (TIME_EVENTS.has(event)) {
    try {
      return mmssToSec(input);
    } catch {
      return null;
    }
  }
  const n = Number(input);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* ---------------------------- date helpers ---------------------------- */

const MS_PER_DAY = 86_400_000;

function todayIsoDate(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function addDaysIso(base: string, days: number): string {
  const d = new Date(base + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weeksBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  const a = Date.parse(from + "T00:00:00Z");
  const b = Date.parse(to + "T00:00:00Z");
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(6, Math.min(26, Math.round((b - a) / (7 * MS_PER_DAY))));
}

/* ---------------------------- live scoring ---------------------------- */

type Raw = { mdl: string; hrp: string; sdc: string; plk: string; mr2: string };

function tryScore(
  event: AftEvent,
  age: number,
  sex: Sex | "",
  raw: string,
): number | null {
  if (!raw || !sex) return null;
  if (!Number.isInteger(age) || age < 17) return null;
  const bracket = ageToBracket(age);

  let n: number;
  if (event === "MDL" || event === "HRP") {
    const v = Number(raw);
    if (!Number.isFinite(v) || v <= 0) return null;
    n = v;
  } else {
    try {
      n = mmssToSec(raw);
    } catch {
      return null;
    }
  }
  return scoreEvent(event, bracket, sex, n);
}

/* ---------------------------- form ---------------------------- */

const DEFAULT_DURATION = 13;

export type InitialFormValues = {
  age?: string;
  sex?: Sex | "";
  bodyweightLb?: string;
  goalBodyweightLb?: string;
  daysPerWeek?: string;
  durationWeeks?: number;
  testDate?: string;
  equipment?: readonly string[];
  injuries?: readonly string[];
  calisthenicsPreferred?: boolean;
  activeRecovery?: boolean;
  current?: Raw;
  goal?: Raw;
};

export function ProfileForm({
  action,
  initialError,
  initialValues,
}: {
  action: (formData: FormData) => Promise<void>;
  initialError?: string;
  initialValues?: InitialFormValues;
}) {
  const today = useMemo(todayIsoDate, []);
  const iv = initialValues ?? {};

  const [age, setAge] = useState<string>(iv.age ?? "");
  const [sex, setSex] = useState<Sex | "">(iv.sex ?? "");
  const [duration, setDuration] = useState<number>(iv.durationWeeks ?? DEFAULT_DURATION);
  const [testDate, setTestDate] = useState<string>(
    iv.testDate ?? addDaysIso(today, (iv.durationWeeks ?? DEFAULT_DURATION) * 7),
  );

  const [current, setCurrent] = useState<Raw>(
    iv.current ?? { mdl: "", hrp: "", sdc: "", plk: "", mr2: "" },
  );
  const [goal, setGoal] = useState<Raw>(
    iv.goal ?? { mdl: "", hrp: "", sdc: "", plk: "", mr2: "" },
  );

  const ageNum = Number.parseInt(age, 10);
  const validAge = Number.isInteger(ageNum) && ageNum >= 17 && ageNum <= 80;

  const score = (raw: Raw): Record<AftEvent, number | null> => ({
    MDL: tryScore("MDL", ageNum, sex, raw.mdl),
    HRP: tryScore("HRP", ageNum, sex, raw.hrp),
    SDC: tryScore("SDC", ageNum, sex, raw.sdc),
    PLK: tryScore("PLK", ageNum, sex, raw.plk),
    "2MR": tryScore("2MR", ageNum, sex, raw.mr2),
  });

  const currentPoints = score(current);
  const goalPoints = score(goal);
  const currentTotal = sumPoints(currentPoints);
  const goalTotal = sumPoints(goalPoints);

  /* sync handlers */
  const onTestDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setTestDate(v);
    if (v) setDuration(weeksBetween(today, v));
  };
  const onDurationChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = Number.parseInt(e.target.value, 10);
    if (!Number.isFinite(v)) return;
    setDuration(v);
    setTestDate(addDaysIso(today, v * 7));
  };

  const applyPreset = (weeks: number) => {
    setDuration(weeks);
    setTestDate(addDaysIso(today, weeks * 7));
  };

  return (
    <form action={action} className="mt-8 space-y-10">
      {initialError && (
        <p className="rounded-md border border-[var(--color-danger)] bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">
          {initialError}
        </p>
      )}

      <Section title="Athlete">
        <Row>
          <NumberInput
            name="age"
            label="Age"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            min={17}
            max={80}
            required
            placeholder="e.g. 32"
            autoFocus
          />
          <Select
            name="sex"
            label="Scoring lane"
            value={sex}
            onChange={(e) => setSex(e.target.value as Sex | "")}
            required
          >
            <option value="" disabled>Choose…</option>
            <option value="MC">M (or Combat MOS, sex-neutral)</option>
            <option value="F">F (Female, enabling)</option>
          </Select>
          <NumberInput
            name="bodyweightLb"
            label="Bodyweight (lb)"
            placeholder="e.g. 190"
            defaultValue={iv.bodyweightLb}
            min={80}
            max={500}
            required
          />
          <NumberInput
            name="goalBodyweightLb"
            label="Goal bodyweight (lb, optional)"
            placeholder="e.g. 180"
            defaultValue={iv.goalBodyweightLb}
            min={80}
            max={500}
          />
        </Row>
        {validAge && (
          <p className="mt-2 text-xs text-[var(--color-ink-3)]">
            Scoring bracket: <span className="font-mono">{ageToBracket(ageNum)}</span>
          </p>
        )}
      </Section>

      <Section title="Training availability">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[var(--color-ink-3)]">Quick fill:</span>
          <PresetButton onClick={() => applyPreset(13)}>Today + 13 wk (90 days)</PresetButton>
          <PresetButton onClick={() => applyPreset(8)}>Today + 8 wk</PresetButton>
          <PresetButton onClick={() => applyPreset(6)}>Today + 6 wk</PresetButton>
          <PresetButton onClick={() => applyPreset(18)}>Today + 18 wk</PresetButton>
        </div>
        <Row>
          <Select name="daysPerWeek" label="Days per week" defaultValue={iv.daysPerWeek ?? "5"} required>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6">6</option>
          </Select>
          <NumberInput
            name="durationWeeks"
            label="Plan length (weeks)"
            value={String(duration)}
            onChange={onDurationChange}
            min={6}
            max={26}
            required
            hint={`Synced from test date`}
          />
          <DateInput
            name="testDate"
            label="Test date"
            value={testDate}
            onChange={onTestDateChange}
            min={today}
            required
            hint={`Today: ${today}`}
          />
        </Row>
      </Section>

      <Section title="Equipment available">
        <CheckGroup
          name="equipment"
          options={[
            ["barbell", "Barbell + plates"],
            ["rack", "Squat rack"],
            ["dumbbells", "Dumbbells"],
            ["kettlebell", "Kettlebells"],
            ["sled", "Sled (for SDC)"],
            ["pullup_bar", "Pull-up bar"],
            ["track", "Track / measured route"],
            ["treadmill", "Treadmill"],
          ]}
          checkedValues={iv.equipment ?? []}
        />
      </Section>

      <Section title="Injuries / limitations">
        <CheckGroup
          name="injuries"
          options={[
            ["knee", "Knee"],
            ["lower_back", "Lower back"],
            ["achilles", "Achilles / calf"],
            ["shoulder", "Shoulder"],
            ["hip", "Hip"],
            ["wrist", "Wrist"],
          ]}
          checkedValues={iv.injuries ?? []}
        />
      </Section>

      <Section title="Preferences">
        <CheckBox
          name="calisthenicsPreferred"
          label="Prefer calisthenics for full-body / accessory work (pull-ups, dips, single-leg)"
          defaultChecked={iv.calisthenicsPreferred ?? false}
        />
        <CheckBox
          name="activeRecovery"
          label="Recovery days are active (mobility + walk/bike/swim), not couch rest"
          defaultChecked={iv.activeRecovery ?? true}
        />
      </Section>

      <ScoreSection
        title="Current AFT (your real numbers)"
        raw={current}
        setRaw={setCurrent}
        points={currentPoints}
        total={currentTotal}
        prefix="current"
        canScore={validAge && sex !== ""}
        ageNum={ageNum}
        sex={sex}
      />

      <ScoreSection
        title="Goal AFT (what you're chasing)"
        raw={goal}
        setRaw={setGoal}
        points={goalPoints}
        total={goalTotal}
        prefix="goal"
        canScore={validAge && sex !== ""}
        ageNum={ageNum}
        sex={sex}
        maintainFrom={current}
      />

      <SummaryStrip
        currentTotal={currentTotal}
        goalTotal={goalTotal}
        testDate={testDate}
        duration={duration}
        canScore={validAge && sex !== ""}
      />

      <div className="border-t border-[var(--color-line)] pt-6">
        <button
          type="submit"
          className="rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-[var(--color-accent-fg)] hover:opacity-90"
        >
          Generate my plan
        </button>
      </div>
    </form>
  );
}

/* ---------------------------- AFT score section ---------------------------- */

function ScoreSection(props: {
  title: string;
  raw: Raw;
  setRaw: (r: Raw) => void;
  points: Record<AftEvent, number | null>;
  total: number;
  prefix: "current" | "goal";
  canScore: boolean;
  ageNum: number;
  sex: Sex | "";
  maintainFrom?: Raw;
}) {
  const { title, raw, setRaw, points, total, prefix, canScore, maintainFrom } = props;
  const fieldName = (suffix: string) =>
    `${prefix}${suffix}` as
      | "currentMdlLb"
      | "currentHrpReps"
      | "currentSdc"
      | "currentPlk"
      | "current2MR"
      | "goalMdlLb"
      | "goalHrpReps"
      | "goalSdc"
      | "goalPlk"
      | "goal2MR";

  const copyFromCurrent = (which: keyof Raw) => {
    if (!maintainFrom) return;
    setRaw({ ...raw, [which]: maintainFrom[which] });
  };

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
          {title}
        </h2>
        {canScore && total > 0 && (
          <div className="text-xs text-[var(--color-ink-3)]">
            total <span className="font-mono text-base text-[var(--color-ink)]">{total}</span> pts
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-[var(--color-ink-3)]">
        Type the raw value <em>or</em> a target point value — the other side
        auto-fills.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ScoreField
          event="MDL"
          name={fieldName("MdlLb")}
          label="MDL 3-rep max (lb)"
          rawType="number"
          rawPlaceholder="e.g. 285"
          value={raw.mdl}
          onChange={(v) => setRaw({ ...raw, mdl: v })}
          points={points.MDL}
          canScore={canScore}
          ageNum={props.ageNum}
          sex={props.sex}
          {...(maintainFrom ? { onMaintain: () => copyFromCurrent("mdl") } : {})}
        />
        <ScoreField
          event="HRP"
          name={fieldName("HrpReps")}
          label="HRP (reps in 2:00)"
          rawType="number"
          rawPlaceholder="e.g. 35"
          value={raw.hrp}
          onChange={(v) => setRaw({ ...raw, hrp: v })}
          points={points.HRP}
          canScore={canScore}
          ageNum={props.ageNum}
          sex={props.sex}
          {...(maintainFrom ? { onMaintain: () => copyFromCurrent("hrp") } : {})}
        />
        <ScoreField
          event="SDC"
          name={fieldName("Sdc")}
          label="SDC (m:ss)"
          rawType="text"
          rawPlaceholder="2:00"
          rawPattern="^\d{1,2}:\d{2}$"
          value={raw.sdc}
          onChange={(v) => setRaw({ ...raw, sdc: v })}
          points={points.SDC}
          canScore={canScore}
          ageNum={props.ageNum}
          sex={props.sex}
          {...(maintainFrom ? { onMaintain: () => copyFromCurrent("sdc") } : {})}
        />
        <ScoreField
          event="PLK"
          name={fieldName("Plk")}
          label="Plank (m:ss)"
          rawType="text"
          rawPlaceholder="2:30"
          rawPattern="^\d{1,2}:\d{2}$"
          value={raw.plk}
          onChange={(v) => setRaw({ ...raw, plk: v })}
          points={points.PLK}
          canScore={canScore}
          ageNum={props.ageNum}
          sex={props.sex}
          {...(maintainFrom ? { onMaintain: () => copyFromCurrent("plk") } : {})}
        />
        <ScoreField
          event="2MR"
          name={fieldName("2MR")}
          label="2-mile run (m:ss)"
          rawType="text"
          rawPlaceholder="17:30"
          rawPattern="^\d{1,2}:\d{2}$"
          value={raw.mr2}
          onChange={(v) => setRaw({ ...raw, mr2: v })}
          points={points["2MR"]}
          canScore={canScore}
          ageNum={props.ageNum}
          sex={props.sex}
          {...(maintainFrom ? { onMaintain: () => copyFromCurrent("mr2") } : {})}
        />
      </div>
    </section>
  );
}

function ScoreField(props: {
  event: AftEvent;
  name: string;
  label: string;
  rawType: "number" | "text";
  rawPlaceholder?: string;
  rawPattern?: string;
  value: string;
  onChange: (v: string) => void;
  points: number | null;
  canScore: boolean;
  ageNum: number;
  sex: Sex | "";
  onMaintain?: () => void;
}) {
  const {
    event,
    name,
    label,
    rawType,
    rawPlaceholder,
    rawPattern,
    value,
    onChange,
    points,
    canScore,
    ageNum,
    sex,
    onMaintain,
  } = props;

  // Local "pts" input state for the convert-in side. Doesn't go to FormData.
  const [ptsInput, setPtsInput] = useState<string>("");

  // When the raw value changes externally (e.g., via "Maintain current"),
  // mirror it into the pts side so the display stays consistent.
  const liveRawValue = parseRaw(event, value);
  const livePoints =
    canScore && liveRawValue !== null
      ? scoreEvent(event, ageToBracket(ageNum), sex as Sex, liveRawValue)
      : null;

  // Choose what to show in the pts input: user's typed pts OR the derived points.
  const ptsDisplay =
    ptsInput !== "" ? ptsInput : livePoints !== null ? String(livePoints) : "";

  const onPtsChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setPtsInput(v);
    const n = Number.parseInt(v, 10);
    if (!Number.isInteger(n) || n < 0 || n > 100) return;
    if (!canScore) return;
    const raw = rawFromPoints(event, ageToBracket(ageNum), sex as Sex, n);
    if (raw === null) return;
    onChange(formatRaw(event, raw));
  };

  const onRawChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPtsInput(""); // user is driving from the raw side; let pts re-derive
    onChange(e.target.value);
  };

  return (
    <div className="block">
      <span className="flex items-baseline justify-between text-sm font-medium text-[var(--color-ink-2)]">
        <span>{label}</span>
        <span className="font-mono text-xs">
          {points === null
            ? canScore
              ? <span className="text-[var(--color-ink-3)]">—</span>
              : null
            : (
              <span className={pointClass(points)}>{points} pts</span>
            )}
        </span>
      </span>
      <div className="mt-1 flex gap-2">
        <div className="flex-1">
          <input
            name={name}
            type={rawType}
            value={value}
            onChange={onRawChange}
            placeholder={rawPlaceholder}
            pattern={rawPattern}
            required
            className="block w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--color-accent)] focus:outline-none"
            aria-label={`${label} raw`}
          />
          <span className="mt-0.5 block text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
            raw
          </span>
        </div>
        <div className="w-24">
          <input
            type="number"
            min={0}
            max={100}
            value={ptsDisplay}
            onChange={onPtsChange}
            placeholder="pts"
            disabled={!canScore}
            className="block w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--color-accent)] focus:outline-none disabled:bg-[var(--color-bg-2)] disabled:text-[var(--color-ink-3)]"
            aria-label={`${label} points`}
          />
          <span className="mt-0.5 block text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
            pts
          </span>
        </div>
      </div>

      {canScore && (
        <ScoreSlider
          event={event}
          ageNum={ageNum}
          sex={sex as Sex}
          rawValue={liveRawValue}
          onChange={(raw) => {
            setPtsInput("");
            onChange(formatRaw(event, raw));
          }}
        />
      )}
      {onMaintain && (
        <button
          type="button"
          onClick={() => {
            setPtsInput("");
            onMaintain();
          }}
          className="mt-1 text-xs text-[var(--color-ink-3)] underline hover:text-[var(--color-ink-2)]"
        >
          Maintain current
        </button>
      )}
    </div>
  );
}

function ScoreSlider({
  event,
  ageNum,
  sex,
  rawValue,
  onChange,
}: {
  event: AftEvent;
  ageNum: number;
  sex: Sex;
  rawValue: number | null;
  onChange: (raw: number) => void;
}) {
  const bracket = ageToBracket(ageNum);
  const bounds = getRawBounds(event, bracket, sex);
  if (!bounds) return null;

  const step = EVENT_STEP[event];
  const displayValue = rawValue ?? bounds.min;
  // Position 0..1 along the slider track
  const range = Math.max(1, bounds.max - bounds.min);
  const pos = Math.max(0, Math.min(1, (displayValue - bounds.min) / range));

  // For lower-is-better events (SDC, 2MR) the table's min raw = max points,
  // so the slider value direction is still ascending raw (left to right) but
  // the LEFT side represents BETTER performance. We label that explicitly.
  const lowerIsBetter = event === "SDC" || event === "2MR";

  const passingPos =
    bounds.passing !== null
      ? Math.max(0, Math.min(1, (bounds.passing - bounds.min) / range))
      : null;

  const fmt = (raw: number): string =>
    TIME_EVENTS.has(event) ? secToMmss(raw) : `${Math.round(raw)}`;

  return (
    <div className="mt-2">
      <div className="relative h-6">
        <input
          type="range"
          min={bounds.min}
          max={bounds.max}
          step={step}
          value={displayValue}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={`${event} slider`}
          className="aft-slider relative z-10 block h-6 w-full cursor-pointer appearance-none bg-transparent"
        />
        {passingPos !== null && (
          <div
            className="pointer-events-none absolute top-1/2 h-2 w-px -translate-y-1/2 bg-[var(--color-danger)] opacity-60"
            style={{ left: `${passingPos * 100}%` }}
            title="60-point pass line"
          />
        )}
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-[var(--color-ink-3)]">
        <span className="font-mono">
          {fmt(bounds.min)}
          <span className="ml-1 opacity-60">
            {lowerIsBetter ? "fast" : "min"}
          </span>
        </span>
        {bounds.passing !== null && (
          <span className="font-mono">
            <span className="opacity-60">pass </span>
            {fmt(bounds.passing)}
          </span>
        )}
        <span className="font-mono">
          {fmt(bounds.max)}
          <span className="ml-1 opacity-60">
            {lowerIsBetter ? "slow" : "max"}
          </span>
        </span>
      </div>
    </div>
  );
}

function pointClass(pts: number): string {
  if (pts >= 100) return "text-[var(--color-accent)] font-semibold";
  if (pts >= 80) return "text-[var(--color-ink)]";
  if (pts >= 60) return "text-[var(--color-ink-2)]";
  return "text-[var(--color-danger)]";
}

function sumPoints(p: Record<AftEvent, number | null>): number {
  return (p.MDL ?? 0) + (p.HRP ?? 0) + (p.SDC ?? 0) + (p.PLK ?? 0) + (p["2MR"] ?? 0);
}

/* ---------------------------- summary strip ---------------------------- */

function SummaryStrip(props: {
  currentTotal: number;
  goalTotal: number;
  testDate: string;
  duration: number;
  canScore: boolean;
}) {
  const { currentTotal, goalTotal, testDate, duration, canScore } = props;
  if (!canScore) return null;
  return (
    <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-2)] p-4 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <Stat label="Current" value={`${currentTotal} pts`} />
        <Stat label="Goal" value={`${goalTotal} pts`} />
        <Stat label="Δ" value={goalTotal && currentTotal ? `+${Math.max(0, goalTotal - currentTotal)}` : "—"} />
        <Stat label="Plan length" value={`${duration} weeks`} />
        <Stat label="Test date" value={testDate || "—"} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[var(--color-ink-3)]">{label}</div>
      <div className="font-mono text-base text-[var(--color-ink)]">{value}</div>
    </div>
  );
}

/* ---------------------------- primitives ---------------------------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
        {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{children}</div>;
}

const labelClass = "block text-sm font-medium text-[var(--color-ink-2)]";
const inputClass =
  "mt-1 block w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--color-accent)] focus:outline-none";

function NumberInput(props: {
  name: string;
  label: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  required?: boolean;
  hint?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{props.label}</span>
      <input
        name={props.name}
        type="number"
        value={props.value}
        defaultValue={props.defaultValue}
        placeholder={props.placeholder}
        min={props.min}
        max={props.max}
        required={props.required}
        onChange={props.onChange}
        autoFocus={props.autoFocus}
        className={inputClass}
      />
      {props.hint && (
        <span className="mt-0.5 block text-xs text-[var(--color-ink-3)]">{props.hint}</span>
      )}
    </label>
  );
}

function DateInput(props: {
  name: string;
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  min?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{props.label}</span>
      <input
        name={props.name}
        type="date"
        value={props.value}
        onChange={props.onChange}
        min={props.min}
        required={props.required}
        className={inputClass}
      />
      {props.hint && (
        <span className="mt-0.5 block text-xs text-[var(--color-ink-3)]">{props.hint}</span>
      )}
    </label>
  );
}

function Select(props: {
  name: string;
  label: string;
  value?: string;
  defaultValue?: string;
  required?: boolean;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{props.label}</span>
      <select
        name={props.name}
        value={props.value}
        defaultValue={props.defaultValue}
        required={props.required}
        onChange={props.onChange}
        className={inputClass}
      >
        {props.children}
      </select>
    </label>
  );
}

function CheckBox(props: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-[var(--color-ink-2)]">
      <input
        type="checkbox"
        name={props.name}
        defaultChecked={props.defaultChecked}
        className="h-4 w-4 rounded border-[var(--color-line)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
      />
      <span>{props.label}</span>
    </label>
  );
}

function CheckGroup(props: {
  name: string;
  options: [string, string][];
  checkedValues?: readonly string[];
}) {
  const checked = new Set(props.checkedValues ?? []);
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {props.options.map(([value, label]) => (
        <label
          key={value}
          className="flex items-center gap-2 rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm text-[var(--color-ink-2)] hover:bg-[var(--color-bg-2)]"
        >
          <input
            type="checkbox"
            name={props.name}
            value={value}
            defaultChecked={checked.has(value)}
            className="h-4 w-4 rounded border-[var(--color-line)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
          />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

function PresetButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-[var(--color-line)] bg-white px-3 py-1 text-xs text-[var(--color-ink-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
    >
      {children}
    </button>
  );
}
