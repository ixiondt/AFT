"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm text-[var(--color-ink-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] print:hidden"
    >
      Print / save PDF
    </button>
  );
}
