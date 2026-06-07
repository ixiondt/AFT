import Link from "next/link";

export default function Landing() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
      <p className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-ink-3)]">
        Army Fitness Test &nbsp;·&nbsp; 5 events &nbsp;·&nbsp; 500 max
      </p>
      <h1 className="mt-4 text-5xl font-bold tracking-tight text-[var(--color-ink)] sm:text-6xl">
        Train for the number{" "}
        <span className="text-[var(--color-accent)]">you want</span>.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-[var(--color-ink-2)]">
        Enter your current scores and your goal. Pick how many weeks you have. Get a
        periodized program with exact weights, paces, intervals, and checkpoints —
        rebuilt as you log workouts.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--color-accent-fg)] shadow-sm hover:opacity-90"
        >
          Create account
        </Link>
        <Link
          href="/signin"
          className="rounded-lg border border-[var(--color-line)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-accent)]"
        >
          Sign in
        </Link>
      </div>

      <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          { ev: "MDL", c: "var(--color-mdl)", label: "Deadlift" },
          { ev: "HRP", c: "var(--color-hrp)", label: "Push-ups" },
          { ev: "SDC", c: "var(--color-sdc)", label: "Sprint-drag-carry" },
          { ev: "PLK", c: "var(--color-plk)", label: "Plank" },
          { ev: "2MR", c: "var(--color-2mr)", label: "2-mile run" },
        ].map((e) => (
          <div
            key={e.ev}
            className="rounded-lg border border-[var(--color-line)] bg-white p-3"
          >
            <span
              className="inline-flex h-5 items-center rounded px-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white"
              style={{ background: e.c }}
            >
              {e.ev}
            </span>
            <div className="mt-2 text-xs text-[var(--color-ink-2)]">{e.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-16 border-t border-[var(--color-line)] pt-8 text-xs text-[var(--color-ink-3)]">
        Scoring based on the official AFT Scoring Scales effective 1&nbsp;June&nbsp;2025.
        Not affiliated with the US Army.
      </div>
    </main>
  );
}
