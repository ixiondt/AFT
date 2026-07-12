/**
 * Shared presentational primitives.
 *
 * Design ideas adapted from a wellness-app prototype but rebuilt in AFT's
 * OKLCH token system and kept within the project's anti-slop rules:
 *   - NO side-stripe accent borders (soft tinted backgrounds instead)
 *   - NO gradient surfaces on cards/callouts (solid / color-mix tints)
 *   - rounded-lg / rounded-xl only
 *
 * Every component here is server-component-safe (no hooks, no event handlers)
 * so pages can render them without a client boundary. `<details>`-based
 * disclosure (Explainer) works without JS.
 */
import type { ReactNode } from "react";
import { clsx } from "clsx";

/* ------------------------------------------------------------------ tones */

export type Tone = "info" | "good" | "warn" | "danger" | "neutral";

/** Base CSS var for each tone. */
const TONE_VAR: Record<Tone, string> = {
  info: "var(--color-info)",
  good: "var(--color-accent)",
  warn: "var(--color-warn)",
  danger: "var(--color-danger)",
  neutral: "var(--color-ink-3)",
};

/** Soft, theme-aware background tint for a tone (works in light + dark). */
function toneSoftBg(tone: Tone): string {
  return `color-mix(in oklch, ${TONE_VAR[tone]} 12%, var(--color-bg))`;
}
/** Subtle tone-tinted border — a full border, never a stripe. */
function toneBorder(tone: Tone): string {
  return `color-mix(in oklch, ${TONE_VAR[tone]} 32%, var(--color-line))`;
}

/* ---------------------------------------------------------------- Callout */

const TONE_ICON: Record<Tone, string> = {
  info: "ⓘ",
  good: "✓",
  warn: "⚠",
  danger: "⛔",
  neutral: "•",
};

/**
 * Soft-tinted advisory box. Replaces the prototype's side-striped alert with
 * a full-bordered, tinted card that reads correctly in dark mode.
 */
export function Callout({
  tone = "info",
  title,
  icon,
  children,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  /** Override the default tone glyph; pass null to hide it entirely. */
  icon?: ReactNode | null;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="note"
      className={clsx("flex gap-3 rounded-lg border px-4 py-3 text-sm", className)}
      style={{ background: toneSoftBg(tone), borderColor: toneBorder(tone) }}
    >
      {icon !== null && (
        <span
          aria-hidden="true"
          className="mt-px shrink-0 text-base leading-5"
          style={{ color: TONE_VAR[tone] }}
        >
          {icon ?? TONE_ICON[tone]}
        </span>
      )}
      <div className="min-w-0">
        {title && (
          <div className="font-semibold" style={{ color: TONE_VAR[tone] }}>
            {title}
          </div>
        )}
        {children && (
          <div className={clsx(title && "mt-0.5", "text-[var(--color-ink-2)]")}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- ProgressBar */

/**
 * Horizontal completion bar. Value is a percentage; it is clamped to 0–100 and
 * guards against NaN/Infinity so a bad denominator upstream can't blow it up.
 */
export function ProgressBar({
  value,
  tone = "good",
  label,
  valueLabel,
  className,
}: {
  value: number;
  tone?: Tone;
  label?: ReactNode;
  /** Right-aligned readout; defaults to the rounded percentage. */
  valueLabel?: ReactNode;
  className?: string;
}) {
  const pct = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  const rounded = Math.round(pct);
  return (
    <div className={className}>
      {(label || valueLabel !== null) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
          <span className="text-[var(--color-ink-2)]">{label}</span>
          <span className="font-mono font-medium text-[var(--color-ink)]">
            {valueLabel ?? `${rounded}%`}
          </span>
        </div>
      )}
      <div
        className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-2)]"
        role="progressbar"
        aria-valuenow={rounded}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          className="block h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: TONE_VAR[tone] }}
        />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- Chip */

/**
 * Small pill for status / metadata. `color` accepts any of AFT's event tokens
 * (--color-mdl etc.) or a tone via the `tone` prop.
 */
export function Chip({
  children,
  tone = "neutral",
  color,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  /** Raw CSS color override (e.g. "var(--color-hrp)"). Wins over `tone`. */
  color?: string;
  className?: string;
}) {
  const c = color ?? TONE_VAR[tone];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        className,
      )}
      style={{
        color: c,
        background: `color-mix(in oklch, ${c} 14%, var(--color-bg))`,
      }}
    >
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- Timeline */

export function Timeline({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ol
      className={clsx(
        "relative ml-1.5 space-y-4 border-l border-[var(--color-line)] pl-5",
        className,
      )}
    >
      {children}
    </ol>
  );
}

export function TimelineItem({
  title,
  meta,
  tone = "good",
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  tone?: Tone;
  children?: ReactNode;
}) {
  return (
    <li className="relative">
      <span
        aria-hidden="true"
        className="absolute -left-[calc(1.25rem+1px)] top-1 h-2.5 w-2.5 -translate-x-1/2 rounded-full ring-2 ring-[var(--color-bg)]"
        style={{ background: TONE_VAR[tone] }}
      />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-sm font-medium text-[var(--color-ink)]">{title}</span>
        {meta && <span className="font-mono text-[11px] text-[var(--color-ink-3)]">{meta}</span>}
      </div>
      {children && <div className="mt-0.5 text-xs text-[var(--color-ink-3)]">{children}</div>}
    </li>
  );
}

/* ---------------------------------------------------------------- Explainer */

/**
 * Collapsible "why did the app do this?" disclosure. Native <details>, so it
 * works without JS. Soft card, no side-stripe (the prototype used a purple
 * left border — banned here).
 */
export function Explainer({
  question,
  children,
  defaultOpen,
  className,
}: {
  question: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={clsx(
        "group rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-2)] px-4 py-3 [&_summary::-webkit-details-marker]:hidden",
        className,
      )}
    >
      <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium text-[var(--color-ink)]">
        {question}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0 text-[var(--color-ink-3)] transition-transform group-open:rotate-180"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="mt-2 text-sm leading-relaxed text-[var(--color-ink-2)]">{children}</div>
    </details>
  );
}

/* --------------------------------------------------------------------- Stat */

/**
 * Metric tile: label + big mono value, optional unit, optional trend subline.
 * `tone` colors the value (good/warn/danger). Consolidates the ad-hoc Stat
 * components that were duplicated across dashboard/progress.
 */
export function Stat({
  label,
  value,
  unit,
  trend,
  tone,
  size = "lg",
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  trend?: ReactNode;
  tone?: "good" | "ok" | "warn" | "danger";
  size?: "md" | "lg";
}) {
  const color =
    tone === "good"
      ? "text-[var(--color-accent)]"
      : tone === "warn"
        ? "text-[var(--color-warn)]"
        : tone === "danger"
          ? "text-[var(--color-danger)]"
          : "text-[var(--color-ink)]";
  return (
    <div>
      <div className="text-xs text-[var(--color-ink-3)]">{label}</div>
      <div
        className={clsx(
          "font-mono font-semibold",
          size === "lg" ? "text-2xl" : "text-base",
          color,
        )}
      >
        {value}
        {unit && (
          <span className="ml-1 text-sm font-normal text-[var(--color-ink-3)]">{unit}</span>
        )}
      </div>
      {trend && <div className="mt-0.5 text-[11px] text-[var(--color-ink-3)]">{trend}</div>}
    </div>
  );
}
