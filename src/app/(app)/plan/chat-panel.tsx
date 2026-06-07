"use client";

import { useRef } from "react";
import { sendChatMessage } from "./chat-actions";

export type ChatMessageView = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string; // ISO
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
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  return (
    <section className="print:hidden">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
          AI assistant
        </h2>
        {!groqEnabled && (
          <span className="text-xs text-[var(--color-danger)]">
            GROQ_API_KEY not configured
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-[var(--color-ink-3)]">
        Ask the coach to adjust your plan. Edits apply directly to the saved plan;
        regenerate to start over with the baseline.
      </p>

      <div className="mt-3 space-y-3">
        {messages.length === 0 && (
          <div className="rounded-md border border-dashed border-[var(--color-line)] p-4 text-sm text-[var(--color-ink-3)]">
            No messages yet. Try one of:
            <ul className="mt-2 space-y-1">
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
                    className="text-left text-[var(--color-ink-2)] underline-offset-2 hover:text-[var(--color-accent)] hover:underline"
                  >
                    &ldquo;{s}&rdquo;
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "ml-auto max-w-[85%] rounded-lg bg-[var(--color-bg-2)] p-3 text-sm text-[var(--color-ink)]"
                : "max-w-[85%] rounded-lg border border-[var(--color-line)] bg-white p-3 text-sm text-[var(--color-ink-2)]"
            }
          >
            <div className="mb-1 text-[10px] font-mono uppercase tracking-wider text-[var(--color-ink-3)]">
              {m.role === "user" ? "you" : "coach"}
            </div>
            <div className="whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}
      </div>

      <form
        ref={formRef}
        action={async (fd) => {
          await sendChatMessage(fd);
          if (inputRef.current) inputRef.current.value = "";
        }}
        className="mt-4"
      >
        <label className="block">
          <span className="sr-only">Your message</span>
          <textarea
            ref={inputRef}
            name="message"
            required
            rows={2}
            maxLength={2000}
            disabled={!groqEnabled}
            placeholder={
              groqEnabled
                ? "Ask the coach to adjust the plan…"
                : "Add GROQ_API_KEY to enable chat"
            }
            className="block w-full resize-y rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--color-accent)] focus:outline-none disabled:bg-[var(--color-bg-2)] disabled:text-[var(--color-ink-3)]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
          />
        </label>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-[var(--color-ink-3)]">
            Cmd/Ctrl + Enter to send
          </span>
          <button
            type="submit"
            disabled={!groqEnabled}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-sm font-medium text-[var(--color-accent-fg)] hover:opacity-90 disabled:bg-[var(--color-ink-3)] disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </form>
    </section>
  );
}
