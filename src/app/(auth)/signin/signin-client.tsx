"use client";

import Link from "next/link";
import { forwardRef, useEffect, useRef, useState } from "react";
import { signInWithPasswordAction, signInWithPinAction } from "./actions";

const LAST_USER_KEY = "aft-last-user";

export function SignInClient({ initialError }: { initialError?: string }) {
  const [mode, setMode] = useState<"password" | "pin">("password");
  const [email, setEmail] = useState("");
  const [hasPin, setHasPin] = useState(false);
  const [checking, setChecking] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  // On mount: read remembered email + check has-pin
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(LAST_USER_KEY);
    if (!stored) return;
    setEmail(stored);
    setChecking(true);
    fetch(`/api/auth/has-pin?email=${encodeURIComponent(stored)}`)
      .then((r) => r.json())
      .then((data: { hasPin?: boolean }) => {
        if (data.hasPin) {
          setHasPin(true);
          setMode("pin");
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  // Re-check has-pin when the user types a different email (debounced)
  useEffect(() => {
    if (!email || !email.includes("@") || email.length < 4) return;
    const handle = window.setTimeout(() => {
      fetch(`/api/auth/has-pin?email=${encodeURIComponent(email.trim().toLowerCase())}`)
        .then((r) => r.json())
        .then((data: { hasPin?: boolean }) => {
          setHasPin(Boolean(data.hasPin));
          if (!data.hasPin && mode === "pin") setMode("password");
        })
        .catch(() => {});
    }, 350);
    return () => window.clearTimeout(handle);
  }, [email, mode]);

  // Persist email to localStorage on every successful-looking submit. The form
  // action redirects, so we run this in the form's onSubmit BEFORE submit.
  const rememberEmail = () => {
    const v = email.trim().toLowerCase();
    if (v.includes("@")) window.localStorage.setItem(LAST_USER_KEY, v);
  };

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <p className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--color-ink-3)]">
        Sign in
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Welcome back</h1>

      {mode === "pin" && hasPin && (
        <p className="mt-1 text-sm text-[var(--color-ink-2)]">
          Signing in as <span className="font-mono">{email}</span>
        </p>
      )}

      {mode === "password" ? (
        <form
          action={signInWithPasswordAction}
          onSubmit={rememberEmail}
          className="mt-8 space-y-4"
        >
          <Field
            ref={emailRef}
            name="email"
            type="email"
            label="Email"
            autoComplete="email"
            value={email}
            onChange={setEmail}
            required
          />
          <Field
            name="password"
            type="password"
            label="Password"
            autoComplete="current-password"
            required
          />
          {initialError === "invalid" && (
            <p className="text-sm text-[var(--color-danger)]">
              Invalid email or password.
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-fg)] hover:opacity-90"
          >
            Sign in
          </button>
          {hasPin && !checking && (
            <button
              type="button"
              onClick={() => setMode("pin")}
              className="block w-full text-center text-xs text-[var(--color-accent)] hover:underline"
            >
              Use your PIN instead
            </button>
          )}
        </form>
      ) : (
        <form
          action={signInWithPinAction}
          onSubmit={rememberEmail}
          className="mt-8 space-y-4"
        >
          <input type="hidden" name="email" value={email} />
          <Field
            name="pin"
            type="password"
            label="PIN"
            inputMode="numeric"
            pattern="[0-9]{4,6}"
            maxLength={6}
            placeholder="••••"
            autoComplete="one-time-code"
            required
            autoFocus
            mono
          />
          {initialError === "pin" && (
            <p className="text-sm text-[var(--color-danger)]">
              Invalid PIN. After 5 wrong attempts you'll need to use your password.
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-fg)] hover:opacity-90"
          >
            Sign in with PIN
          </button>
          <button
            type="button"
            onClick={() => setMode("password")}
            className="block w-full text-center text-xs text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
          >
            Use password instead
          </button>
          <button
            type="button"
            onClick={() => {
              window.localStorage.removeItem(LAST_USER_KEY);
              setEmail("");
              setHasPin(false);
              setMode("password");
            }}
            className="block w-full text-center text-xs text-[var(--color-ink-3)] hover:text-[var(--color-danger)]"
          >
            Not you? Forget this device
          </button>
        </form>
      )}

      <p className="mt-6 text-sm text-[var(--color-ink-3)]">
        No account?{" "}
        <Link className="underline" href="/signup">
          Create one
        </Link>
        .
      </p>
    </main>
  );
}

type FieldProps = {
  name: string;
  type: string;
  label: string;
  autoComplete?: string;
  required?: boolean;
  value?: string;
  onChange?: (v: string) => void;
  inputMode?: "numeric";
  pattern?: string;
  maxLength?: number;
  placeholder?: string;
  autoFocus?: boolean;
  mono?: boolean;
};

const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(props, ref) {
  return (
    <label className="block">
      <span className="block text-xs font-mono uppercase tracking-wider text-[var(--color-ink-3)]">
        {props.label}
      </span>
      <input
        ref={ref}
        name={props.name}
        type={props.type}
        autoComplete={props.autoComplete}
        required={props.required}
        inputMode={props.inputMode}
        pattern={props.pattern}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        autoFocus={props.autoFocus}
        value={props.value}
        onChange={props.onChange ? (e) => props.onChange!(e.target.value) : undefined}
        className={
          "mt-1 block w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--color-accent)] focus:outline-none" +
          (props.mono ? " font-mono text-center text-2xl tracking-[0.5em]" : "")
        }
      />
    </label>
  );
});
