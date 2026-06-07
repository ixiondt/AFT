"use client";

export function WeekControls() {
  const setAll = (open: boolean) => {
    const all = document.querySelectorAll<HTMLDetailsElement>("details.aft-week");
    all.forEach((d) => {
      if (open) d.setAttribute("open", "");
      else d.removeAttribute("open");
    });
  };

  return (
    <div className="flex items-center gap-2 print:hidden">
      <button
        type="button"
        onClick={() => setAll(true)}
        className="rounded-full border border-[var(--color-line)] bg-white px-3 py-1 text-xs text-[var(--color-ink-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      >
        Expand all
      </button>
      <button
        type="button"
        onClick={() => setAll(false)}
        className="rounded-full border border-[var(--color-line)] bg-white px-3 py-1 text-xs text-[var(--color-ink-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      >
        Collapse all
      </button>
    </div>
  );
}
