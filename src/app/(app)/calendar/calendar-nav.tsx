"use client";

import { useRouter } from "next/navigation";

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function shiftMonth(ym: string, delta: number): string {
  const m = /^(\d{4})-(\d{1,2})$/.exec(ym);
  if (!m) return ym;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const next = new Date(Date.UTC(y, mo + delta, 1));
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}`;
}

function thisYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function CalendarNav({ currentMonth }: { currentMonth: string }) {
  const router = useRouter();
  const go = (m: string) => router.push(`/calendar?m=${m}`, { scroll: false });

  return (
    <div className="flex items-center gap-1 print:hidden">
      <button
        type="button"
        aria-label="Previous month"
        onClick={() => go(shiftMonth(currentMonth, -1))}
        className="grid h-8 w-8 place-items-center rounded-full border border-[var(--color-line)] bg-white text-[var(--color-ink-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => go(thisYm())}
        className="rounded-full border border-[var(--color-line)] bg-white px-3 py-1 text-xs text-[var(--color-ink-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      >
        Today
      </button>
      <button
        type="button"
        aria-label="Next month"
        onClick={() => go(shiftMonth(currentMonth, +1))}
        className="grid h-8 w-8 place-items-center rounded-full border border-[var(--color-line)] bg-white text-[var(--color-ink-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}
