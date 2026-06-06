import Link from "next/link";

export default function Landing() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
        Army Fitness Test
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-ink)]">
        Personalized AFT training plans.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-[var(--color-ink-2)]">
        Enter your current scores and your goal. Pick how many weeks you have. Get a
        periodized program with exact weights, paces, intervals, and checkpoints.
      </p>

      <div className="mt-8 flex gap-3">
        <Link
          href="/signup"
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] hover:opacity-90"
        >
          Create account
        </Link>
        <Link
          href="/signin"
          className="rounded-lg border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-bg-2)]"
        >
          Sign in
        </Link>
      </div>

      <div className="mt-16 border-t border-[var(--color-line)] pt-8 text-sm text-[var(--color-ink-3)]">
        Scoring based on the official AFT Scoring Scales effective 1&nbsp;June&nbsp;2025
        (MDL, HRP, SDC, PLK, 2MR). Not affiliated with the US Army.
      </div>
    </main>
  );
}
