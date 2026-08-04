# AFT Planner

A web app for the U.S. Army Fitness Test (AFT): score the five events, generate a
periodized individual training plan, track body composition (WHtR/ABCP), and plan
**group PT for Annual Training** across a unit's roster — with medical-profile
accommodations throughout.

## Features

- **AFT scoring** — the 5 events (MDL, HRP, SDC, PLK, 2-mile run), 10 age brackets,
  MC/F lanes, 60-per-event pass logic. Live scoring as you type on `/profile`.
- **Individual training plan** — a deterministic periodized plan (Base → Build →
  Peak → Test) with per-event progressions and VDOT-based run paces. Optional AI
  narrative + chat coach (Groq). Workout logging, calendar, progress charts.
- **Body composition** — WHtR (waist ÷ height) as the sole standard per Army
  Directive 2026-13; DA Form 5500 (Jul 2026) and ABCP paperwork export.
- **Medical profiles (DA 3349)** — temporary/permanent, restrictions, exempt
  events, alternate aerobic event, lift limit. Drives both:
  - **Training accommodations** — runs → alternate cardio, load caps, impact
    swaps, exempt-event removal (`src/lib/planner/accommodations.ts`).
  - **Profile-aware scoring** ("full doctrinal") — exempt events excluded from the
    total; permanent-profile alternate aerobic scored **Go/No-Go = 60** replacing
    the 2-mile; temporary profile = diagnostic, not a record
    (`src/lib/scoring/profiled.ts`). No alternate-event time standards are
    hardcoded — the Go/No-Go is an entered result.
- **Units & group AT PT** — an MFT owns a unit and manages a roster (hybrid model:
  enter soldiers directly; they can later *claim* their entry to link an account).
  Generate an Annual Training plan (`src/lib/at/`): ability groups by baseline
  2-mile time, a daily formation schedule (Preparation → Activities → Recovery),
  and per-soldier cards with scaled pace/load + accommodations. Print or download
  a PDF.

## Stack

Next.js 15 (App Router, RSC + server actions) · React 19 · TypeScript · Tailwind v4
· PostgreSQL + Drizzle ORM · Auth.js (NextAuth 5, credentials + PIN) · Groq SDK ·
pdf-lib · Zod · Pino.

## Data model (`src/lib/db/schema.ts`)

Auth: `users`, `accounts`, `sessions`, `verification_tokens`, `groq_calls`.
Individual: `profiles`, `medical_profiles`, `aft_tests` (+ `profile_context`),
`goals`, `plans`, `weight_logs`, `plan_chat_messages`, `workouts`.
Group: `units` (unique name per owner), `unit_members` (baseline snapshot,
nullable `user_id` for claim, `alternate_result`), `at_plans`.

## Development

```bash
npm install
npm run db:up          # start local Postgres (podman compose)
npm run db:migrate     # apply migrations
npm run dev            # http://localhost:3000
```

Env: copy `.env.example` → `.env` (`DATABASE_URL`, `AUTH_SECRET`, optional
`GROQ_API_KEY`). Tests own their env via `vitest.config.ts`.

```bash
npm run typecheck      # tsc --noEmit
npm run test           # vitest (pure units: scoring, planner, AT, schemas)
npm run build          # next build
npm run db:generate    # regenerate migrations after a schema change
```

## Deployment

Push to `main` → GitHub Actions (`.github/workflows/deploy.yml`) builds the image,
pushes to ghcr, then on the droplet applies pending migrations (one-shot
`scripts/migrate.mjs`) and swaps the container behind Caddy, with a `/api/health`
check. Migrations are idempotent (`IF NOT EXISTS`, partial indexes).

## Not yet built

- AFT-scoring: two-way profile sync on claim beyond the initial seed.
- AI coach currently covers the individual plan only (group-PT coach in progress).
- Known: `CI` Trivy scan flags a `next-auth` beta advisory (GHSA-8fpg-xm3f-6cx3) —
  pending a careful auth-library bump; does not block deploys.
