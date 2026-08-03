"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const TABS = [
  { href: "/dashboard", label: "Home", icon: HomeIcon },
  { href: "/plan", label: "Plan", icon: PlanIcon },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon },
  { href: "/progress", label: "Progress", icon: ProgressIcon },
  { href: "/body", label: "Body", icon: BodyIcon },
  { href: "/units", label: "Units", icon: UnitsIcon },
] as const;

export function AppNav({
  isAdmin,
  children,
}: {
  isAdmin?: boolean;
  /**
   * Right-rail slot for streamed content (e.g. the "Today" badge). The slot
   * renders immediately as null and fills in once the server component
   * resolves — keeps the nav from blocking on the plan query.
   */
  children?: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";

  return (
    <>
      {/* Desktop top bar */}
      <header className="sticky top-0 z-30 hidden border-b border-[var(--color-line)] bg-[var(--color-bg)] backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_oklch,var(--color-bg)_85%,transparent)] sm:block print:hidden">
        <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-2.5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[var(--color-ink)]"
          >
            <span
              className="grid h-7 w-7 place-items-center rounded-md text-[10px] font-bold text-white"
              style={{ background: "var(--color-accent)" }}
            >
              AFT
            </span>
            <span className="hidden md:inline">Planner</span>
          </Link>

          <div className="flex items-center gap-1">
            {TABS.map((t) => {
              const Active = isActive(pathname, t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  prefetch
                  className={
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors " +
                    (Active
                      ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                      : "text-[var(--color-ink-2)] hover:bg-[var(--color-bg-2)]")
                  }
                >
                  {t.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {children}
            {isAdmin && (
              <Link
                href="/admin"
                className={
                  "hidden rounded-full px-3 py-1 text-xs font-medium transition-colors md:block " +
                  (pathname.startsWith("/admin")
                    ? "bg-[var(--color-ink)] text-[var(--color-bg)]"
                    : "text-[var(--color-ink-3)] hover:bg-[var(--color-bg-2)]")
                }
                title="Admin panel"
              >
                Admin
              </Link>
            )}
            <ThemeToggle />
          </div>
        </nav>
      </header>

      {/* Mobile bottom bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-line)] bg-[var(--color-bg)] pb-[max(env(safe-area-inset-bottom),0.25rem)] sm:hidden print:hidden"
        aria-label="App navigation"
      >
        <ul className="grid grid-cols-6">
          {TABS.map((t) => {
            const Active = isActive(pathname, t.href);
            const Icon = t.icon;
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  prefetch
                  className={
                    "flex flex-col items-center gap-0.5 py-2 text-[10px] " +
                    (Active
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-ink-3)] hover:text-[var(--color-ink-2)]")
                  }
                >
                  <Icon active={Active} />
                  <span className="font-medium">{t.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Spacer so mobile content doesn't get hidden under the bottom bar */}
      <div className="h-16 sm:hidden print:hidden" aria-hidden="true" />
    </>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

/* ---------------- theme toggle ---------------- */

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = (localStorage.getItem("aft-theme") as "light" | "dark" | null) ?? "system";
    setTheme(stored);
  }, []);

  const apply = (next: "light" | "dark" | "system") => {
    setTheme(next);
    if (next === "system") localStorage.removeItem("aft-theme");
    else localStorage.setItem("aft-theme", next);
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    if (next !== "system") root.classList.add(next);
  };

  const cycle = () => {
    const order: ("light" | "dark" | "system")[] = ["system", "light", "dark"];
    const idx = order.indexOf(theme);
    apply(order[(idx + 1) % order.length]!);
  };

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${theme}`}
      aria-label="Toggle theme"
      className="grid h-8 w-8 place-items-center rounded-full border border-[var(--color-line)] text-[var(--color-ink-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
    >
      {theme === "dark" ? <MoonIcon /> : theme === "light" ? <SunIcon /> : <AutoIcon />}
    </button>
  );
}

/* ---------------- icons ---------------- */

function DotIcon() {
  return (
    <span
      className="block h-1.5 w-1.5 animate-pulse rounded-full"
      style={{ background: "var(--color-accent)" }}
      aria-hidden="true"
    />
  );
}

function BodyIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="5" r="2.5" fill={active ? "currentColor" : "none"} fillOpacity={active ? "0.12" : "0"} />
      <path d="M8 22V14H6L8 8h8l2 6h-2v8" fill={active ? "currentColor" : "none"} fillOpacity={active ? "0.12" : "0"} />
    </svg>
  );
}

function UnitsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3" fill={active ? "currentColor" : "none"} fillOpacity={active ? "0.12" : "0"} />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" fill={active ? "currentColor" : "none"} fillOpacity={active ? "0.12" : "0"} />
      <circle cx="17" cy="9" r="2.2" />
      <path d="M16 14.2A4.8 4.8 0 0 1 21 19" />
    </svg>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}
function PlanIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" fill={active ? "currentColor" : "none"} fillOpacity={active ? "0.12" : "0"} />
      <path d="M8 4v4M16 4v4M4 10h16" />
    </svg>
  );
}
function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" fill={active ? "currentColor" : "none"} fillOpacity={active ? "0.12" : "0"} />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </svg>
  );
}
function ProgressIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 17l5-5 4 4 8-9" fill={active ? "currentColor" : "none"} fillOpacity={active ? "0.12" : "0"} />
      <path d="M14 7h7v7" />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
    </svg>
  );
}
function AutoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor" />
    </svg>
  );
}
