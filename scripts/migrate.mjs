/**
 * Apply pending Drizzle migrations to the configured DATABASE_URL.
 * Used by the CI deploy step (`podman run --rm ... node /app/scripts/migrate.mjs`).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false });
const db = drizzle(client);

try {
  console.log("[migrate] applying pending migrations from ./drizzle");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[migrate] done");
} catch (err) {
  console.error("[migrate] failed");
  if (err && typeof err === "object") {
    const e = err;
    console.error("  message:", e.message);
    for (const key of ["code", "severity", "detail", "hint", "where", "schema", "table", "constraint"]) {
      if (e[key]) console.error(`  ${key}:`, e[key]);
    }
    if (e.cause) console.error("  cause:", e.cause);
    if (e.stack) console.error("  stack:", e.stack.split("\n").slice(0, 5).join("\n"));
  } else {
    console.error(err);
  }
  process.exitCode = 2;
} finally {
  await client.end({ timeout: 5 });
}
