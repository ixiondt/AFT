"use client";

import { useRef, useState } from "react";
import { clearPinAction, setPinAction } from "./pin-actions";

export function PinSetupCard({
  hasPin,
  errorParam,
}: {
  hasPin: boolean;
  errorParam?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(errorParam ?? null);
  const formRef = useRef<HTMLFormElement>(null);

  if (hasPin) {
    return (
      <section className="rounded-lg border border-[var(--color-line)] bg-white p-4">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-2">
            <KeyIcon />
            <span className="text-sm font-semibold text-[var(--color-ink)]">
              Quick sign-in PIN is on
            </span>
          </div>
          <form
            action={clearPinAction}
            onSubmit={(e) => {
              if (!confirm) return;
              if (!window.confirm("Remove the PIN for this account?")) {
                e.preventDefault();
              }
            }}
          >
            <button
              type="submit"
              className="text-xs text-[var(--color-ink-3)] hover:text-[var(--color-danger)]"
            >
              Remove PIN
            </button>
          </form>
        </div>
        <p className="mt-1 text-xs text-[var(--color-ink-3)]">
          Next time you sign in on this device, you can type your 4–6 digit PIN
          instead of the full password.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-2)] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <KeyIcon />
          <div>
            <div className="text-sm font-semibold text-[var(--color-ink)]">
              Set a quick sign-in PIN
            </div>
            <div className="text-xs text-[var(--color-ink-3)]">
              4–6 digits, used on this device only. Password still works as a fallback.
            </div>
          </div>
        </div>
        {!expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-[var(--color-accent-fg)] hover:opacity-90"
          >
            Set PIN
          </button>
        )}
      </div>

      {expanded && (
        <form
          ref={formRef}
          action={setPinAction}
          onSubmit={(e) => {
            setError(null);
            if (!/^\d{4,6}$/.test(pin)) {
              e.preventDefault();
              setError("PIN must be 4–6 digits");
              return;
            }
            if (pin !== confirm) {
              e.preventDefault();
              setError("PINs don't match");
              return;
            }
          }}
          className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]"
        >
          <label className="block">
            <span className="block text-xs text-[var(--color-ink-3)]">PIN</span>
            <input
              type="password"
              name="pin"
              inputMode="numeric"
              pattern="[0-9]{4,6}"
              maxLength={6}
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="1234"
              required
              className="mt-0.5 block w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--color-accent)] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-[var(--color-ink-3)]">Confirm</span>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4,6}"
              maxLength={6}
              autoComplete="off"
              value={confirm}
              onChange={(e) =>
                setConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="1234"
              required
              className="mt-0.5 block w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--color-accent)] focus:outline-none"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-lg bg-[var(--color-accent)] px-3 py-2 text-xs font-medium text-[var(--color-accent-fg)] hover:opacity-90"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setPin("");
                setConfirm("");
                setError(null);
              }}
              className="text-xs text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>
      )}
    </section>
  );
}

function KeyIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[var(--color-accent)]"
    >
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}
