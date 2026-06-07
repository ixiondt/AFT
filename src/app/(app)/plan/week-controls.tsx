"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function WeekControls() {
  const [query, setQuery] = useState("");
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const setAll = (open: boolean) => {
    const all = document.querySelectorAll<HTMLDetailsElement>("details.aft-week");
    all.forEach((d) => {
      d.style.display = "";
      if (open) d.setAttribute("open", "");
      else d.removeAttribute("open");
    });
    setQuery("");
    setMatchCount(null);
  };

  const applyFilter = useCallback((q: string) => {
    const all = document.querySelectorAll<HTMLDetailsElement>("details.aft-week");
    const needle = q.trim().toLowerCase();
    if (!needle) {
      all.forEach((d) => {
        d.style.display = "";
      });
      setMatchCount(null);
      return;
    }
    let matches = 0;
    all.forEach((d) => {
      // Use textContent for a quick match. Includes the (collapsed) strip + the
      // expanded prescription so a search like "deadlift" hits the right weeks.
      const haystack = (d.textContent ?? "").toLowerCase();
      if (haystack.includes(needle)) {
        d.style.display = "";
        d.setAttribute("open", "");
        matches += 1;
      } else {
        d.style.display = "none";
        d.removeAttribute("open");
      }
    });
    setMatchCount(matches);
  }, []);

  // Apply on each keystroke (debounced via React batching is fine for tens of items).
  useEffect(() => {
    applyFilter(query);
  }, [query, applyFilter]);

  // Cmd/Ctrl-K focuses the search input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
      <div className="relative">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search weeks…"
          className="w-44 rounded-full border border-[var(--color-line)] bg-white py-1 pl-7 pr-3 text-xs text-[var(--color-ink)] shadow-sm focus:border-[var(--color-accent)] focus:outline-none sm:w-56"
          aria-label="Search plan"
        />
        <SearchIcon />
        {matchCount !== null && query && (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--color-ink-3)]">
            {matchCount}
          </span>
        )}
      </div>
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

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-ink-3)]"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
