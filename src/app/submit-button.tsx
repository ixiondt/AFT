"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button that auto-shows a spinner and disables itself while the
 * parent <form>'s action is in flight. Drop in anywhere a server action
 * lives — no per-form pending state needed.
 */
export function SubmitButton({
  children,
  className = "",
  pendingLabel,
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        className +
        " inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {pending && <Spinner />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      className="animate-spin"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
