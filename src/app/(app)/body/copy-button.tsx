"use client";

import { useState } from "react";

/** Copies `text` to the clipboard and briefly confirms. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable — no-op */
        }
      }}
      className="rounded-md border border-[var(--color-line)] px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-[var(--color-ink-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
