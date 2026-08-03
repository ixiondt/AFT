import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthAndUser, listUnitsForUser } from "@/lib/auth";
import { readFlash } from "@/lib/flash";
import { SubmitButton } from "../../submit-button";
import { createUnitAction } from "./actions";

export default async function UnitsPage() {
  const auth = await getAuthAndUser();
  if (!auth || auth.disabled) redirect("/signin");

  const { owned, member } = await listUnitsForUser(auth.user.id);
  const flash = await readFlash();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="border-b border-[var(--color-line)] pb-4">
        <p className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
          Group PT
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Units</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-3)]">
          Build a roster and plan Annual Training PT for the whole unit — ability
          groups by baseline, accommodations for profiles.
        </p>
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

      <section className="mt-8">
        <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
          Units you run
        </h2>
        {owned.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-ink-3)]">
            None yet. Create one below.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {owned.map((u) => (
              <UnitRow key={u.id} id={u.id} name={u.name} tag="MFT / owner" />
            ))}
          </ul>
        )}
      </section>

      {member.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
            Units you're on
          </h2>
          <ul className="mt-3 space-y-2">
            {member.map((u) => (
              <UnitRow key={u.id} id={u.id} name={u.name} tag="member" />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 border-t border-[var(--color-line)] pt-6">
        <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
          Create a unit
        </h2>
        <form action={createUnitAction} className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            name="name"
            required
            maxLength={120}
            placeholder="e.g. B Co, 1-158 IN"
            className="flex-1 rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--color-accent)] focus:outline-none"
          />
          <SubmitButton
            pendingLabel="Creating…"
            className="rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-[var(--color-accent-fg)] hover:opacity-90"
          >
            Create unit
          </SubmitButton>
        </form>
      </section>
    </main>
  );
}

function UnitRow({ id, name, tag }: { id: string; name: string; tag: string }) {
  return (
    <li>
      <Link
        href={`/units/${id}`}
        className="flex items-center justify-between rounded-lg border border-[var(--color-line)] bg-white px-4 py-3 text-sm hover:border-[var(--color-accent)]"
      >
        <span className="font-medium text-[var(--color-ink)]">{name}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
          {tag}
        </span>
      </Link>
    </li>
  );
}
