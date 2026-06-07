import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadActivePlan } from "@/lib/aft/plan-service";
import type { Plan } from "@/lib/planner";
import { env } from "@/lib/env";
import { loadChatHistory } from "@/lib/aft/chat-service";
import {
  BlockBar,
  CheckpointList,
  GapTable,
  MdlLadderTable,
  NarrativeSection,
  PaceCard,
  PlanSummary,
  WeeklyCalendar,
} from "./components";
import { ChatPanel, type ChatMessageView } from "./chat-panel";
import { PrintButton } from "./print-button";

export default async function PlanPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const planRow = await loadActivePlan(session.user.id);
  if (!planRow) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">No plan yet</h1>
        <p className="mt-2 text-[var(--color-ink-2)]">
          Build your profile and enter your AFT scores to generate one.
        </p>
        <Link
          href="/profile"
          className="mt-6 inline-block rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] hover:opacity-90"
        >
          Start
        </Link>
      </main>
    );
  }

  const plan = planRow.payload as Plan;
  const chatHistory = await loadChatHistory(planRow.id);
  const chatMessages: ChatMessageView[] = chatHistory.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }));
  const groqEnabled = Boolean(env.groqApiKey);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="flex items-baseline justify-between border-b border-[var(--color-line)] pb-4 print:border-b-0">
        <div>
          <p className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
            Active plan
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Your AFT program</h1>
        </div>
        <div className="flex items-center gap-3 print:hidden">
          <a
            href="/api/plan/ics"
            download
            className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm text-[var(--color-ink-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            Download .ics
          </a>
          <PrintButton />
          <Link
            href="/profile"
            className="text-sm text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
          >
            Regenerate
          </Link>
        </div>
      </header>

      <div className="mt-8 space-y-10">
        <PlanSummary plan={plan} />
        <GapTable plan={plan} />
        <BlockBar plan={plan} />
        <NarrativeSection plan={plan} />
        <PaceCard plan={plan} />
        <MdlLadderTable plan={plan} />
        <CheckpointList plan={plan} />
        <WeeklyCalendar plan={plan} />
        <ChatPanel messages={chatMessages} groqEnabled={groqEnabled} />
      </div>

      <footer className="mt-12 border-t border-[var(--color-line)] pt-4 text-xs text-[var(--color-ink-3)]">
        Plan generated {new Date(plan.generatedAt).toLocaleString()} · scoring per official
        AFT scales effective 1 June 2025.
      </footer>
    </main>
  );
}
