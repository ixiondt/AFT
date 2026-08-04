"use client";

import { SubmitButton } from "../../../../submit-button";
import { postAtChatAction } from "./chat-actions";

export type CoachMessage = { id: string; role: "user" | "assistant"; content: string };

export function AtCoachPanel({
  unitId,
  messages,
}: {
  unitId: string;
  messages: readonly CoachMessage[];
}) {
  return (
    <section className="rounded-xl border border-[var(--color-line)] p-4 print:hidden">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <span>🎖️</span> MFT coach
      </h2>
      <p className="mt-0.5 text-xs text-[var(--color-ink-3)]">
        Ask about ability groups or progressions — or tell it to adjust the plan
        (“make day 6 a rest day”, “move SGT Doe to Group B”). Changes apply above.
      </p>

      {messages.length > 0 && (
        <ul className="mt-3 space-y-3">
          {messages.map((m) => (
            <li
              key={m.id}
              className={m.role === "user" ? "text-sm" : "text-sm"}
            >
              <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]">
                {m.role === "user" ? "You" : "Coach"}
              </div>
              <div
                className={
                  "mt-0.5 whitespace-pre-wrap rounded-lg px-3 py-2 " +
                  (m.role === "user"
                    ? "bg-[var(--color-bg-2)] text-[var(--color-ink)]"
                    : "border border-[var(--color-line)] text-[var(--color-ink-2)]")
                }
              >
                {m.content}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* key on message count → textarea clears after each exchange */}
      <form key={messages.length} action={postAtChatAction} className="mt-3">
        <input type="hidden" name="unitId" value={unitId} />
        <textarea
          name="message"
          rows={2}
          maxLength={2000}
          required
          placeholder="e.g. How should Group C progress over the two weeks?"
          className="block w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--color-accent)] focus:outline-none"
        />
        <div className="mt-2 flex justify-end">
          <SubmitButton
            pendingLabel="Asking…"
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] hover:opacity-90"
          >
            Ask the coach
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}
