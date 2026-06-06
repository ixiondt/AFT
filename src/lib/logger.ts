import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";
// In Next.js (server runtime), worker-thread transports can't be bundled in dev.
// Detect Next.js context and emit raw JSON instead of using pino-pretty.
const isNextRuntime = Boolean(process.env.NEXT_RUNTIME);
const usePretty = isDev && !isNextRuntime;

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  redact: {
    paths: [
      "password",
      "passwordHash",
      "*.password",
      "*.passwordHash",
      "token",
      "secret",
      "*.token",
      "*.secret",
      "authorization",
      "cookie",
    ],
    censor: "[REDACTED]",
  },
  ...(usePretty
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss" },
        },
      }
    : {}),
});

export type Logger = typeof logger;
