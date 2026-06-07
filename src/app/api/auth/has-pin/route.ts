import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Public endpoint — given a candidate email, says whether that account has a PIN.
 * Returns { hasPin } always, never reveals whether the email is registered or not
 * (to avoid being a user enumeration oracle).
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const emailRaw = url.searchParams.get("email") ?? "";
  if (emailRaw.length > 254 || !emailRaw.includes("@")) {
    return Response.json({ hasPin: false });
  }
  const email = emailRaw.toLowerCase();

  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });

  return Response.json({ hasPin: Boolean(user?.pinHash) });
}
