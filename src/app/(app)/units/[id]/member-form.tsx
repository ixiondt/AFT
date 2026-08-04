"use client";

import { useState } from "react";
import { secToMmss } from "@/lib/scoring";
import { SubmitButton } from "../../../submit-button";
import type { RosterMember } from "@/lib/units/service";

const inputClass =
  "mt-1 block w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--color-accent)] focus:outline-none";
const labelClass = "block text-sm font-medium text-[var(--color-ink-2)]";

function str(n: number | null | undefined): string {
  return n === null || n === undefined ? "" : String(n);
}
function mmss(sec: number | null | undefined): string {
  return sec === null || sec === undefined ? "" : secToMmss(sec);
}

export function MemberForm({
  action,
  unitId,
  member,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  unitId: string;
  member?: RosterMember;
  submitLabel: string;
}) {
  const prof = member?.medicalProfile ?? null;
  const [hasProfile, setHasProfile] = useState<boolean>(Boolean(prof));
  const restrictions = new Set((prof?.restrictions ?? []) as string[]);
  const exempt = new Set((prof?.exemptEvents ?? []) as string[]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="unitId" value={unitId} />
      {member && <input type="hidden" name="memberId" value={member.id} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-2">
          <span className={labelClass}>Name / rank</span>
          <input
            name="displayName"
            required
            maxLength={120}
            defaultValue={member?.displayName ?? ""}
            placeholder="e.g. SGT Doe"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Role</span>
          <select name="role" defaultValue={member?.role ?? "member"} className={inputClass}>
            <option value="member">Member</option>
            <option value="mft">MFT (can manage roster)</option>
          </select>
        </label>
      </div>

      <fieldset className="rounded-lg border border-[var(--color-line)] p-3">
        <legend className="px-1 text-xs font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
          Baseline (optional)
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field name="age" label="Age" type="number" defaultValue={str(member?.age)} />
          <label className="block">
            <span className={labelClass}>Sex</span>
            <select name="sex" defaultValue={member?.sex ?? ""} className={inputClass}>
              <option value="">—</option>
              <option value="MC">M / combat</option>
              <option value="F">F</option>
            </select>
          </label>
          <Field name="bodyweightLb" label="Weight (lb)" type="number" defaultValue={str(member?.bodyweightLb)} />
          <Field name="heightIn" label="Height (in)" type="number" step={0.5} defaultValue={str(member?.heightIn)} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Field name="mdlLb" label="MDL (lb)" type="number" defaultValue={str(member?.mdlLb)} />
          <Field name="hrpReps" label="HRP" type="number" defaultValue={str(member?.hrpReps)} />
          <Field name="sdcSec" label="SDC" placeholder="m:ss" defaultValue={mmss(member?.sdcSec)} />
          <Field name="plkSec" label="PLK" placeholder="m:ss" defaultValue={mmss(member?.plkSec)} />
          <Field name="twoMileSec" label="2MR" placeholder="m:ss" defaultValue={mmss(member?.twoMileSec)} />
        </div>
      </fieldset>

      <div className="rounded-lg border border-[var(--color-line)] p-3">
        <label className="flex items-center gap-2 text-sm text-[var(--color-ink-2)]">
          <input
            type="checkbox"
            name="hasMedicalProfile"
            checked={hasProfile}
            onChange={(e) => setHasProfile(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--color-line)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
          />
          <span>Medical profile (DA 3349)</span>
        </label>

        {hasProfile && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block">
                <span className={labelClass}>Type</span>
                <select
                  name="profileType"
                  defaultValue={prof?.profileType ?? "temporary"}
                  className={inputClass}
                >
                  <option value="temporary">Temporary</option>
                  <option value="permanent">Permanent</option>
                </select>
              </label>
              <label className="block">
                <span className={labelClass}>Start</span>
                <input
                  type="date"
                  name="profileStart"
                  defaultValue={prof?.startDate ? new Date(prof.startDate).toISOString().slice(0, 10) : ""}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Expires</span>
                <input
                  type="date"
                  name="profileExpires"
                  defaultValue={prof?.expiresAt ? new Date(prof.expiresAt).toISOString().slice(0, 10) : ""}
                  className={inputClass}
                />
              </label>
            </div>

            <CheckGrid
              name="restrictions"
              legend="Restrictions"
              options={[
                ["no_run", "No running"],
                ["no_impact", "No impact"],
                ["no_ruck", "No ruck"],
                ["no_overhead", "No overhead"],
                ["lift_limit", "Lift limit"],
                ["run_own_pace", "Own pace"],
              ]}
              checked={restrictions}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Alternate aerobic</span>
                <select
                  name="alternateAerobic"
                  defaultValue={prof?.alternateAerobic ?? "none"}
                  className={inputClass}
                >
                  <option value="none">None</option>
                  <option value="walk">2.5-mi walk</option>
                  <option value="row">5k row</option>
                  <option value="bike">12k bike</option>
                  <option value="swim">1k swim</option>
                </select>
              </label>
              <Field name="liftLimitLb" label="Lift limit (lb)" type="number" step={5} defaultValue={str(prof?.liftLimitLb)} />
              <label className="block">
                <span className={labelClass}>Alt event result</span>
                <select
                  name="alternateResult"
                  defaultValue={member?.alternateResult ?? ""}
                  className={inputClass}
                >
                  <option value="">—</option>
                  <option value="go">Go (60)</option>
                  <option value="no_go">No-Go</option>
                </select>
              </label>
            </div>

            <CheckGrid
              name="exemptEvents"
              legend="Exempt events"
              options={[
                ["MDL", "MDL"],
                ["HRP", "HRP"],
                ["SDC", "SDC"],
                ["PLK", "PLK"],
                ["2MR", "2MR"],
              ]}
              checked={exempt}
            />

            <label className="block">
              <span className={labelClass}>Notes</span>
              <textarea
                name="profileNotes"
                rows={2}
                maxLength={500}
                defaultValue={prof?.notes ?? ""}
                className={inputClass}
              />
            </label>
          </div>
        )}
      </div>

      <SubmitButton
        pendingLabel="Saving…"
        className="rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-[var(--color-accent-fg)] hover:opacity-90"
      >
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  step,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  step?: number;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input
        name={name}
        type={type}
        step={step}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={inputClass}
      />
    </label>
  );
}

function CheckGrid({
  name,
  legend,
  options,
  checked,
}: {
  name: string;
  legend: string;
  options: [string, string][];
  checked: Set<string>;
}) {
  return (
    <fieldset>
      <legend className={labelClass}>{legend}</legend>
      <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map(([value, label]) => (
          <label
            key={value}
            className="flex items-center gap-2 rounded-md border border-[var(--color-line)] bg-white px-2 py-1.5 text-xs text-[var(--color-ink-2)]"
          >
            <input
              type="checkbox"
              name={name}
              value={value}
              defaultChecked={checked.has(value)}
              className="h-3.5 w-3.5 rounded border-[var(--color-line)] text-[var(--color-accent)]"
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
