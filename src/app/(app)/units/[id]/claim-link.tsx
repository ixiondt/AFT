"use client";

import { useState } from "react";

/** Shows a member's claim URL (built from the current origin) with a copy button. */
export function ClaimLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/units/claim/${token}`;

  const copy = async () => {
    const url =
      typeof window !== "undefined" ? window.location.origin + path : path;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[11px] text-[var(--color-ink-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
      title="Copy the claim link to share with this soldier"
    >
      {copied ? "Copied!" : "Copy claim link"}
    </button>
  );
}
