import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { signIn } from "@/lib/auth";
import { logger } from "@/lib/logger";

const signupSchema = z.object({
  email: z.string().email().max(254),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .max(128)
    .regex(/[A-Za-z]/, "Must include a letter")
    .regex(/[0-9]/, "Must include a number"),
  name: z.string().min(1).max(120).optional(),
});

async function signUpAction(formData: FormData) {
  "use server";
  const parsed = signupSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
    name: formData.get("name") ? String(formData.get("name")) : undefined,
  });
  if (!parsed.success) {
    redirect(`/signup?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "invalid")}`);
  }
  const { email, password, name } = parsed.data;

  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });
  if (existing) {
    redirect(`/signup?error=${encodeURIComponent("Account already exists")}`);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.insert(schema.users).values({ email, passwordHash, name });
  logger.info({ email }, "user signup");

  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
      <form action={signUpAction} className="mt-6 space-y-4">
        <Field name="name" type="text" label="Name (optional)" autoComplete="name" />
        <Field name="email" type="email" label="Email" autoComplete="email" required />
        <Field
          name="password"
          type="password"
          label="Password (8+ chars, letter & number)"
          autoComplete="new-password"
          required
        />
        {error && (
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        )}
        <button
          type="submit"
          className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] hover:opacity-90"
        >
          Create account
        </button>
      </form>
      <p className="mt-6 text-sm text-[var(--color-ink-3)]">
        Already have one?{" "}
        <Link className="underline" href="/signin">
          Sign in
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
