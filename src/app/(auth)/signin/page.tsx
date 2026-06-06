import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";

async function signInAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (err) {
    // Auth.js throws a redirect on success; only real failures land here.
    if ((err as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw err;
    redirect("/signin?error=invalid");
  }
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <form action={signInAction} className="mt-6 space-y-4">
        <Field name="email" type="email" label="Email" autoComplete="email" required />
        <Field
          name="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          required
        />
        {error === "invalid" && (
          <p className="text-sm text-[var(--color-danger)]">
            Invalid email or password.
          </p>
        )}
        <button
          type="submit"
          className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] hover:opacity-90"
        >
          Sign in
        </button>
      </form>
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

function Field(props: {
  name: string;
  label: string;
  type: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-[var(--color-ink-2)]">
        {props.label}
      </span>
      <input
        name={props.name}
        type={props.type}
        autoComplete={props.autoComplete}
        required={props.required}
        className="mt-1 block w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--color-accent)] focus:outline-none"
      />
    </label>
  );
}
