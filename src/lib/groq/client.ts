import Groq from "groq-sdk";
import { env } from "@/lib/env";

/** Returns a configured Groq client, or null if no API key is set. */
export function getGroqClient(): Groq | null {
  const key = env.groqApiKey;
  if (!key) return null;
  return new Groq({ apiKey: key });
}
