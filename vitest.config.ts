import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@data": path.resolve(__dirname, "data"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    // Tests own their env. Some modules (e.g. @/lib/db, auth) read these at
    // import time; a well-formed dummy URL lets them load without connecting —
    // the postgres client is lazy and these unit tests issue no queries.
    env: {
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
      AUTH_SECRET: "test-secret-not-used-in-unit-tests",
    },
  },
});
