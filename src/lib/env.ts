/**
 * Lazy env accessor — throws on first access if a required var is missing.
 * Done as getters so `next build` static analysis doesn't trip module-load errors.
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get authSecret() {
    return required("AUTH_SECRET");
  },
  get authUrl() {
    return process.env.AUTH_URL ?? "http://localhost:3000";
  },
  get nodeEnv() {
    return process.env.NODE_ENV ?? "development";
  },
  /** Optional. If unset, narrative-layer features fall back to a deterministic-only plan. */
  get groqApiKey(): string | undefined {
    return process.env.GROQ_API_KEY?.trim() || undefined;
  },
  /** Override the Groq model via env. Default is the recommended 3.3 70B class. */
  get groqModel(): string {
    return process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";
  },
};
