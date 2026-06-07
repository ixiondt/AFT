"use client";

import { useEffect, useState } from "react";

export function FlashToast({
  type,
  message,
}: {
  type: "ok" | "warn" | "error";
  message: string;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Clear cookie immediately so the toast doesn't re-show on next render.
    document.cookie = "aft-flash=; max-age=0; path=/";
    const t = window.setTimeout(() => setVisible(false), 3000);
    return () => window.clearTimeout(t);
  }, []);

  if (!visible) return null;

  const bg =
    type === "ok"
      ? "var(--color-accent)"
      : type === "warn"
        ? "var(--color-warn)"
        : "var(--color-danger)";

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2 px-4 sm:bottom-6"
    >
      <div
        className="pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg"
        style={{ background: bg, color: "white" }}
      >
        {type === "ok" ? <CheckIcon /> : type === "warn" ? <BellIcon /> : <XIcon />}
        {message}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
