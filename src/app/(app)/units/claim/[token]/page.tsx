import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getAuthAndUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { SubmitButton } from "../../../../submit-button";
import { claimAction } from "./actions";

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const auth = await getAuthAndUser();
  if (!auth || auth.disabled) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/units/claim/${token}`)}`);
  }

  // Look up the pending entry to show what's being claimed (read-only).
  const member = await db.query.unitMembers.findFirst({
    where: eq(schema.unitMembers.claimToken, token),
  });
  const unit = member
    ? await db.query.units.findFirst({ where: eq(schema.units.id, member.unitId) })
    : null;

  const valid = Boolean(member && !member.userId && unit);

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-xl font-semibold tracking-tight">Join a unit roster</h1>

      {!valid ? (
        <div className="mt-4">
          <p className="text-sm text-[var(--color-danger)]">
            This claim link is invalid or has already been used.
          </p>
          <Link href="/units" className="mt-4 inline-block text-sm text-[var(--color-accent)] hover:underline">
            Go to Units
          </Link>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-[var(--color-ink-2)]">
            You're about to link your account to{" "}
            <span className="font-medium">{member!.displayName}</span> on{" "}
            <span className="font-medium">{unit!.name}</span>.
          </p>
          <form action={claimAction} className="mt-6 flex items-center gap-3">
            <input type="hidden" name="token" value={token} />
            <SubmitButton
              pendingLabel="Joining…"
              className="rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-[var(--color-accent-fg)] hover:opacity-90"
            >
              Join this roster
            </SubmitButton>
            <Link href="/units" className="text-sm text-[var(--color-ink-3)] hover:underline">
              Cancel
            </Link>
          </form>
        </div>
      )}
    </main>
  );
}
