import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadInitialFormValues } from "@/lib/aft/profile-loader";
import { generatePlanAction } from "./actions";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const { error } = await searchParams;
  const initialValues = await loadInitialFormValues(session.user.id);
  const hasPrior = initialValues.age !== undefined;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="border-b border-[var(--color-line)] pb-4">
        <p className="text-sm font-mono uppercase tracking-widest text-[var(--color-ink-3)]">
          {hasPrior ? "Regenerate" : "Step 1"}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {hasPrior ? "Adjust and regenerate" : "Tell me about you and your AFT"}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-ink-3)]">
          {hasPrior
            ? "Your last entries are prefilled below. Edit only what's changed; everything else stays the same."
            : "Points score live as you type. Test date and plan length sync automatically."}
        </p>
      </header>

      <ProfileForm
        action={generatePlanAction}
        initialError={error}
        initialValues={initialValues}
      />
    </main>
  );
}
