import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex items-center justify-between border-b border-[var(--color-line)] pb-4">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-sm text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
          >
            Sign out
          </button>
        </form>
      </header>

      <section className="mt-8 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-2)] p-6">
        <p className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
          Next step
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--color-ink)]">
          Build your profile and enter current scores
        </h2>
        <p className="mt-2 text-sm text-[var(--color-ink-2)]">
          We'll score against the official AFT tables, find your biggest point gaps, and
          generate a periodized plan for the duration you choose.
        </p>
        <Link
          href="/profile"
          className="mt-4 inline-block rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] hover:opacity-90"
        >
          Start
        </Link>
      </section>

      <p className="mt-12 text-xs text-[var(--color-ink-3)]">
        Signed in as <span className="font-mono">{session.user.email}</span>
      </p>
    </main>
  );
}
