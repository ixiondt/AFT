import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

const pinSchema = z.object({
  email: z.string().email().max(254),
  pin: z.string().regex(/^\d{4,6}$/),
});

/**
 * Per-account PIN rate limiter — bounded in-memory map. Bypasses per-IP
 * rotation tactics by keying on the email. 5 attempts per 15 minutes.
 * Persists across the lifetime of the process.
 */
type PinBucket = { count: number; resetAt: number };
const PIN_ATTEMPTS_MAX = 5;
const PIN_ATTEMPTS_WINDOW_MS = 15 * 60 * 1000;
const pinAttempts =
  ((globalThis as { __aftPinAttempts?: Map<string, PinBucket> }).__aftPinAttempts ??=
    new Map());

function countPinAttempt(emailKey: string): boolean {
  const now = Date.now();
  const entry = pinAttempts.get(emailKey);
  if (entry && entry.resetAt > now) {
    entry.count += 1;
    return entry.count <= PIN_ATTEMPTS_MAX;
  }
  pinAttempts.set(emailKey, { count: 1, resetAt: now + PIN_ATTEMPTS_WINDOW_MS });
  return true;
}
function clearPinAttempts(emailKey: string): void {
  pinAttempts.delete(emailKey);
}

const config: NextAuthConfig = {
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 }, // 7 days
  secret: env.authSecret,
  providers: [
    Credentials({
      name: "Email + Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await db.query.users.findFirst({
          where: eq(schema.users.email, email.toLowerCase()),
        });
        if (!user?.passwordHash) {
          logger.debug({ email }, "auth: no user or no password hash");
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          logger.debug({ email }, "auth: bad password");
          return null;
        }

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
    Credentials({
      id: "pin",
      name: "PIN",
      credentials: {
        email: { label: "Email", type: "email" },
        pin: { label: "PIN", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = pinSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, pin } = parsed.data;
        const emailKey = email.toLowerCase();

        if (!countPinAttempt(emailKey)) {
          logger.warn({ email }, "auth: pin rate-limited");
          return null;
        }

        const user = await db.query.users.findFirst({
          where: eq(schema.users.email, emailKey),
        });
        if (!user?.pinHash) {
          logger.debug({ email }, "auth: no user or no pin hash");
          return null;
        }

        const ok = await bcrypt.compare(pin, user.pinHash);
        if (!ok) {
          logger.debug({ email }, "auth: bad pin");
          return null;
        }

        clearPinAttempts(emailKey);
        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  pages: { signIn: "/signin" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
