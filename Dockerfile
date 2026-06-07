# syntax=docker/dockerfile:1.7
# Multi-stage build for Next.js standalone output.

# -------- deps --------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --ignore-scripts --no-audit --no-fund

# -------- builder --------
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js's "collect page data" phase eagerly evaluates module-level imports.
# These stubs satisfy the lazy env getters during build only — the actual
# values come from /opt/apps/aft/.env at runtime, never from these.
ENV DATABASE_URL=postgres://build:build@localhost:5432/build_stub
ENV AUTH_SECRET=build_time_only_not_used_at_runtime_must_be_32_chars_min
ENV AUTH_URL=http://localhost:3000
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# -------- runner --------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Runtime artifacts only.
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Next.js standalone tracing doesn't include drizzle-orm/postgres-js/migrator
# (it's only imported by scripts/migrate.mjs, which isn't a Next.js route).
# Overlay the full versions from the deps stage so the migration container can
# resolve them. Each ~1-2 MB.
COPY --from=deps /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps /app/node_modules/postgres ./node_modules/postgres

# Add curl for healthcheck inside the container (small package, ~1.5 MB)
RUN apk add --no-cache curl

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
