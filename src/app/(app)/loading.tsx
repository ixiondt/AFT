/**
 * Fallback for any (app) route while its server components load.
 * Renders instantly on click → the user sees a pulse + dimmed shell
 * rather than the old page sitting frozen.
 */
export default function AppLoading() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-24 rounded bg-[var(--color-line)]" />
        <div className="h-9 w-72 rounded bg-[var(--color-line)]" />
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="h-32 rounded-lg bg-[var(--color-line)]" />
          <div className="h-32 rounded-lg bg-[var(--color-line)]" />
          <div className="h-32 rounded-lg bg-[var(--color-line)]" />
          <div className="h-32 rounded-lg bg-[var(--color-line)]" />
        </div>
        <div className="h-48 rounded-lg bg-[var(--color-line)]" />
      </div>
    </main>
  );
}
