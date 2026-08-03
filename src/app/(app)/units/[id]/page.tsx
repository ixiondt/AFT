import Link from "next/link";
import { requireUnitAccess } from "@/lib/auth";
import { getUnitRoster, type RosterMember } from "@/lib/units/service";
import { ageToBracket, scoreAft, secToMmss } from "@/lib/scoring";
import { readFlash } from "@/lib/flash";
import { SubmitButton } from "../../../submit-button";
import { MemberForm } from "./member-form";
import { ClaimLink } from "./claim-link";
import { addMemberAction, removeMemberAction, updateMemberAction } from "./actions";

export default async function UnitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireUnitAccess(id); // any member may view
  const canManage = ctx.role === "owner" || ctx.role === "mft";

  const roster = await getUnitRoster(id);
  const flash = await readFlash();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between gap-3">
        <Link href="/units" className="text-xs text-[var(--color-ink-3)] hover:underline">
          ← Units
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
          {ctx.role}
        </span>
      </div>

      <header className="mt-2 border-b border-[var(--color-line)] pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">{ctx.unit.name}</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-3)]">
          {roster.length} {roster.length === 1 ? "soldier" : "soldiers"} on the roster
        </p>
        {canManage && (
          <Link
            href={`/units/${id}/at`}
            className="mt-3 inline-block rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] hover:opacity-90"
          >
            Plan Annual Training PT →
          </Link>
        )}
      </header>

      {flash && (
        <p
          className={
            "mt-4 rounded-md border px-3 py-2 text-sm " +
            (flash.type === "error"
              ? "border-[var(--color-danger)] text-[var(--color-danger)]"
              : "border-[var(--color-line)] text-[var(--color-ink-2)]")
          }
        >
          {flash.message}
        </p>
      )}

      <section className="mt-8 space-y-3">
        {roster.length === 0 && (
          <p className="text-sm text-[var(--color-ink-3)]">
            No soldiers yet.{canManage ? " Add the first below." : ""}
          </p>
        )}
        {roster.map((m) => (
          <MemberCard
            key={m.id}
            member={m}
            unitId={id}
            canManage={canManage}
          />
        ))}
      </section>

      {canManage && (
        <section className="mt-10 border-t border-[var(--color-line)] pt-6">
          <details>
            <summary className="cursor-pointer text-sm font-medium text-[var(--color-accent)]">
              + Add a soldier
            </summary>
            <div className="mt-4">
              <MemberForm action={addMemberAction} unitId={id} submitLabel="Add soldier" />
            </div>
          </details>
        </section>
      )}
    </main>
  );
}

function baselineSummary(m: RosterMember): string | null {
  if (
    m.age == null ||
    m.sex == null ||
    m.mdlLb == null ||
    m.hrpReps == null ||
    m.sdcSec == null ||
    m.plkSec == null ||
    m.twoMileSec == null
  ) {
    return null;
  }
  const res = scoreAft({
    age: m.age,
    sex: m.sex,
    raw: {
      MDL: m.mdlLb,
      HRP: m.hrpReps,
      SDC: m.sdcSec,
      PLK: m.plkSec,
      "2MR": m.twoMileSec,
    },
  });
  return `${res.total} pts · 2MR ${secToMmss(m.twoMileSec)} · bracket ${ageToBracket(m.age)}`;
}

function MemberCard({
  member,
  unitId,
  canManage,
}: {
  member: RosterMember;
  unitId: string;
  canManage: boolean;
}) {
  const summary = baselineSummary(member);
  const prof = member.medicalProfile;
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-[var(--color-ink)]">{member.displayName}</span>
            {member.role === "mft" && (
              <span className="rounded bg-[var(--color-accent-soft)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-accent)]">
                MFT
              </span>
            )}
            {member.userId ? (
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
                claimed
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 text-xs text-[var(--color-ink-3)]">
            {summary ?? "No baseline yet"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {prof && (
            <span
              className="rounded-full border px-2 py-0.5 text-[11px]"
              style={{ borderColor: "var(--color-info)", color: "var(--color-info)" }}
              title={`${prof.profileType} profile`}
            >
              ♿ {prof.profileType === "permanent" ? "perm" : "temp"} profile
            </span>
          )}
          {canManage && !member.userId && member.claimToken && (
            <ClaimLink token={member.claimToken} />
          )}
        </div>
      </div>

      {canManage && (
        <div className="mt-3 flex items-center gap-4 border-t border-[var(--color-line)] pt-3">
          <details className="flex-1">
            <summary className="cursor-pointer text-xs font-medium text-[var(--color-ink-2)]">
              Edit
            </summary>
            <div className="mt-3">
              <MemberForm
                action={updateMemberAction}
                unitId={unitId}
                member={member}
                submitLabel="Save changes"
              />
            </div>
          </details>
          <form action={removeMemberAction}>
            <input type="hidden" name="unitId" value={unitId} />
            <input type="hidden" name="memberId" value={member.id} />
            <SubmitButton
              pendingLabel="Removing…"
              className="text-xs text-[var(--color-danger)] hover:underline"
            >
              Remove
            </SubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}
