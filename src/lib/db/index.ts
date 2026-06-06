import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

const g = globalThis as typeof globalThis & {
  __aftPgClient?: ReturnType<typeof postgres>;
  __aftDb?: ReturnType<typeof drizzle<typeof schema>>;
};

function makeClient() {
  return postgres(env.databaseUrl, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
  });
}

g.__aftPgClient ??= makeClient();
g.__aftDb ??= drizzle(g.__aftPgClient, { schema });

export const db = g.__aftDb;
export { schema };
