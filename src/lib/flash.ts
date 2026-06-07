import { cookies } from "next/headers";

const COOKIE = "aft-flash";

export type FlashType = "ok" | "warn" | "error";

/** Set a one-shot flash message visible until the next page render clears it. */
export async function setFlash(message: string, type: FlashType = "ok"): Promise<void> {
  const c = await cookies();
  c.set(COOKIE, `${type}|${message}`, {
    path: "/",
    maxAge: 30,
    sameSite: "lax",
    httpOnly: false, // readable by client so it can clear after display
  });
}

export async function readFlash(): Promise<{ type: FlashType; message: string } | null> {
  const c = await cookies();
  const raw = c.get(COOKIE)?.value;
  if (!raw) return null;
  const idx = raw.indexOf("|");
  if (idx === -1) return { type: "ok", message: raw };
  const type = raw.slice(0, idx) as FlashType;
  const message = raw.slice(idx + 1);
  if (!message) return null;
  return { type, message };
}
