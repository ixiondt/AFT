import { SignInClient } from "./signin-client";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <SignInClient initialError={error} />;
}
