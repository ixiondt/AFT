"use client";

import { useEffect, useRef, useState } from "react";
import { sendChatMessage } from "./chat-actions";

export type ChatMessageView = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

const SUGGESTIONS = [
  "Make week 3 easier — I have a wedding that weekend",
  "Swap Friday's strength for pull-ups + dips",
  "Add an extra easy run on Sunday",
  "I tweaked my back — replace deadlifts in week 5 with trap bar",
];

export function ChatPanel({
  messages,
  groqEnabled,
}: {
  messages: readonly ChatMessageView[];
  groqEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Close on Esc when open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Scroll to bottom when opening or when messages change.
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages.length]);

  // Lock body scroll on mobile when open.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    if (window.innerWidth < 768) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  const unread = messages.length;

  return (
    <>
      {/* Floating action button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close coach chat" : "Open coach chat"}
        aria-expanded={open}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-medium text-[var(--color-accent-fg)] shadow-lg shadow-black/20 transition-transform hover:scale-105 active:scale-95 print:hidden md:bottom-6 md:right-6"
      >
        <SparkleIcon />
        <span className="hidden sm:inline">AI Coach</span>
        {!open && unread > 0 && (
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-mono">
            {unread}
          </span>
        )}
      </button>

      {/* Backdrop (mobile) */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity md:hidden print:hidden"
        />
      )}

      {/* Panel */}
      <aside
        aria-hidden={!open}
        aria-label="Coach chat"
        className={
          "fixed z-50 flex flex-col overflow-hidden bg-white shadow-2xl transition-transform print:hidden " +
          // Mobile: full-screen sheet sliding from bottom
          "inset-x-0 bottom-0 top-12 rounded-t-2xl " +
          // Desktop: bottom-right card
          "md:inset-x-auto md:bottom-24 md:right-6 md:top-auto md:h-[600px] md:max-h-[80vh] md:w-[400px] md:rounded-2xl " +
          (open
            ? "translate-y-0 md:translate-y-0"
            : "translate-y-full md:translate-y-4 md:opacity-0 md:pointer-events-none")
        }
      >
        <header className="flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-bg-2)] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)]">
              <SparkleIcon />
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--color-ink)]">AI Coach</div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
                {groqEnabled ? "Plan adjustments via chat" : "Set GROQ_API_KEY to enable"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="rounded-full p-1.5 text-[var(--color-ink-3)] hover:bg-[var(--color-line)] hover:text-[var(--color-ink)]"
          >
            <CloseIcon />
          </button>
        </header>

        <div
          ref={scrollRef}
          className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
        >
          {messages.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--color-ink-2)]">
                Ask the coach to adjust your plan. Edits apply directly to the saved
                plan; regenerate from <span className="font-mono">/profile</span> to
                start over with the baseline.
              </p>
              <p className="text-xs uppercase tracking-wider text-[var(--color-ink-3)]">
                Try one of these
              </p>
              <ul className="space-y-1.5">
                {SUGGESTIONS.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => {
                        if (inputRef.current) {
                          inputRef.current.value = s;
                          inputRef.current.focus();
                        }
                      }}
                      className="w-full rounded-md border border-[var(--color-line)] bg-[var(--color-bg-2)] px-3 py-2 text-left text-sm text-[var(--color-ink-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[var(--color-accent)] px-3 py-2 text-sm text-[var(--color-accent-fg)]"
                    : "max-w-[90%] rounded-2xl rounded-bl-md bg-[var(--color-bg-2)] px-3 py-2 text-sm text-[var(--color-ink)]"
                }
              >
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            ))
          )}
        </div>

        <form
          ref={formRef}
          action={async (fd) => {
            await sendChatMessage(fd);
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="border-t border-[var(--color-line)] bg-white p-3"
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              name="message"
              required
              rows={1}
              maxLength={2000}
              disabled={!groqEnabled}
              placeholder={
                groqEnabled
                  ? "Ask the coach…"
                  : "Add GROQ_API_KEY to enable chat"
              }
              className="block flex-1 resize-none rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-2)] px-3 py-2 text-sm shadow-sm focus:border-[var(--color-accent)] focus:bg-white focus:outline-none disabled:text-[var(--color-ink-3)]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  formRef.current?.requestSubmit();
                }
              }}
            />
            <button
              type="submit"
              disabled={!groqEnabled}
              aria-label="Send"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)] shadow-md transition-transform hover:scale-105 active:scale-95 disabled:bg-[var(--color-ink-3)] disabled:opacity-60"
            >
              <SendIcon />
            </button>
          </div>
          <div className="mt-1.5 text-[10px] text-[var(--color-ink-3)]">
            Enter to send · Shift+Enter for newline · Esc to close
          </div>
        </form>
      </aside>
    </>
  );
}

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.8 5.2 5.2 1.8-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2z" />
      <circle cx="19" cy="18" r="1.5" />
      <circle cx="5" cy="17" r="1" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
