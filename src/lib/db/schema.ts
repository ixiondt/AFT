import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Auth tables (Auth.js Drizzle adapter requires this shape)          */
/* ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  passwordHash: text("password_hash"),
  /** Bcrypt hash of a 4–6 digit PIN for quick re-auth on a known device. Null = no PIN. */
  pinHash: text("pin_hash"),
  /** "admin" sees the /admin panel; "user" is the default. */
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  /** If true, every auth check rejects + signs the user out. Set by admin. */
  disabled: boolean("disabled").notNull().default(false),
  /** Bumped on each successful session check — drives the admin "last seen" column. */
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  /** Cumulative Groq calls / tokens — fast aggregate, granular log in groq_calls. */
  groqCallCount: integer("groq_call_count").notNull().default(0),
  groqInputTokens: integer("groq_input_tokens").notNull().default(0),
  groqOutputTokens: integer("groq_output_tokens").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

  // MFA scaffold (not enabled in V0 but column shape avoids painful future migration)
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  mfaSecretEncrypted: text("mfa_secret_encrypted"),
  mfaVerifiedAt: timestamp("mfa_verified_at", { withTimezone: true }),
  mfaBackupCodes: jsonb("mfa_backup_codes"),
});

/** One row per Groq API call — drives the admin usage time-series. */
export const groqCalls = pgTable(
  "groq_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    purpose: text("purpose").notNull(), // "narrative" | "chat"
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    okFlag: boolean("ok").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("groq_calls_user_idx").on(t.userId, t.createdAt),
    createdIdx: index("groq_calls_created_idx").on(t.createdAt),
  }),
);

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
    userIdx: index("accounts_user_idx").on(t.userId),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => ({ userIdx: index("sessions_user_idx").on(t.userId) }),
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.identifier, t.token] }) }),
);

/* ------------------------------------------------------------------ */
/* Domain tables — profile, AFT tests, goals, plans                   */
/* ------------------------------------------------------------------ */

/** Athlete profile — one row per user. Captures training-relevant inputs. */
export const profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    age: integer("age").notNull(),
    sex: text("sex", { enum: ["MC", "F"] }).notNull(),
    bodyweightLb: integer("bodyweight_lb").notNull(),
    /**
     * Height in inches to the nearest 0.5" (the WHtR measurement precision per
     * AD 2026-13 / TAPE team guidance). Optional — only required for body-comp.
     */
    heightIn: real("height_in"),
    daysPerWeek: integer("days_per_week").notNull(), // 3-6
    equipment: jsonb("equipment").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    injuries: jsonb("injuries").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

/**
 * Medical profile (DA Form 3349) accommodations. Attaches to a `user` (the
 * single-user app) — Phase 2 adds a nullable `unitMemberId` so an MFT-managed
 * roster entry can carry one too. Exactly one active profile per user.
 *
 * V1 scope is *accommodations* (drives the PT the planner prescribes). AFT
 * score-sheet effects (event exclusion, alternate Go/No-Go, temp-profile record
 * block) are deliberately deferred.
 */
export const medicalProfiles = pgTable(
  "medical_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nullable: a roster-entry profile (Phase 2) sets unitMemberId instead. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    /** Nullable: an MFT-managed roster entry's profile sets this instead of userId. */
    unitMemberId: uuid("unit_member_id").references(() => unitMembers.id, {
      onDelete: "cascade",
    }),
    profileType: text("profile_type", { enum: ["temporary", "permanent"] }).notNull(),
    startDate: timestamp("start_date", { withTimezone: true }),
    /** Null for a permanent profile. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** Which AFT events (MDL/HRP/SDC/PLK/2MR) the profile exempts. */
    exemptEvents: jsonb("exempt_events").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    alternateAerobic: text("alternate_aerobic", {
      enum: ["none", "walk", "row", "bike", "swim"],
    })
      .notNull()
      .default("none"),
    /** RestrictionCode[] — no_run, no_impact, lift_limit, etc. */
    restrictions: jsonb("restrictions").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    liftLimitLb: integer("lift_limit_lb"),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("medical_profiles_user_idx").on(t.userId),
    memberIdx: index("medical_profiles_member_idx").on(t.unitMemberId),
    // One active profile per user (partial — roster-entry profiles have null userId).
    activeUserUnique: uniqueIndex("medical_profiles_active_user_unique")
      .on(t.userId)
      .where(sql`${t.active} = true AND ${t.userId} IS NOT NULL`),
    // One active profile per roster member.
    activeMemberUnique: uniqueIndex("medical_profiles_active_member_unique")
      .on(t.unitMemberId)
      .where(sql`${t.active} = true AND ${t.unitMemberId} IS NOT NULL`),
  }),
);

/** A single AFT recorded for a user — either a baseline ("current") or a past test. */
export const aftTests = pgTable(
  "aft_tests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    testedAt: timestamp("tested_at", { withTimezone: true }).notNull(),
    label: text("label").notNull(), // "current", "diagnostic", "checkpoint-30", "test-day", etc.
    mdlLb: integer("mdl_lb").notNull(),
    hrpReps: integer("hrp_reps").notNull(),
    sdcSec: integer("sdc_sec").notNull(),
    plkSec: integer("plk_sec").notNull(),
    twoMileSec: integer("two_mile_sec").notNull(),
    bracketSnapshot: text("bracket_snapshot").notNull(), // age bracket at time of test
    sexSnapshot: text("sex_snapshot", { enum: ["MC", "F"] }).notNull(),
    totalPoints: integer("total_points").notNull(),
    /**
     * When this test was scored under a medical profile, the doctrinal context:
     * which events were exempt, the alternate aerobic event + Go/No-Go, whether
     * it's a record (permanent) or diagnostic (temporary). Null = standard 5-event.
     */
    profileContext: jsonb("profile_context").$type<{
      profileType: "temporary" | "permanent";
      isRecord: boolean;
      exemptEvents: string[];
      alternateAerobic: "none" | "walk" | "row" | "bike" | "swim";
      alternateResult?: "go" | "no_go";
      scoredEventCount: number;
    }>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("aft_tests_user_idx").on(t.userId),
    userTestedIdx: index("aft_tests_user_tested_idx").on(t.userId, t.testedAt),
  }),
);

/** Goal scores for the active plan. One active goal per user at a time. */
export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    testDate: timestamp("test_date", { withTimezone: true }).notNull(),
    goalMdlLb: integer("goal_mdl_lb").notNull(),
    goalHrpReps: integer("goal_hrp_reps").notNull(),
    goalSdcSec: integer("goal_sdc_sec").notNull(),
    goalPlkSec: integer("goal_plk_sec").notNull(),
    goalTwoMileSec: integer("goal_two_mile_sec").notNull(),
    goalTotal: integer("goal_total").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("goals_user_idx").on(t.userId),
    activeUnique: uniqueIndex("goals_active_unique")
      .on(t.userId)
      .where(sql`${t.active} = true`),
  }),
);

/** Generated training plan — one active plan per user. Payload is JSONB. */
export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    baselineTestId: uuid("baseline_test_id")
      .notNull()
      .references(() => aftTests.id, { onDelete: "restrict" }),
    durationWeeks: integer("duration_weeks").notNull(),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    payload: jsonb("payload").notNull(), // periodized week-by-week prescription
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("plans_user_idx").on(t.userId),
    activeUnique: uniqueIndex("plans_active_unique")
      .on(t.userId)
      .where(sql`${t.active} = true`),
  }),
);

/** Bodyweight log entries per user — drives the weight-tracker chart on /plan. */
export const weightLogs = pgTable(
  "weight_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .references(() => plans.id, { onDelete: "set null" }),
    weightLb: integer("weight_lb").notNull(),
    /**
     * Optional body-comp measurements at this weigh-in. All values in inches.
     * Stored verbatim so we can recompute WHtR if the formulas change.
     * `waistReadings` holds the three (or more) navel measurements per DA 5500;
     * `waistIn` remains the single/average value for charts and back-compat.
     * `neckIn`/`hipIn`/`abdomenIn` are legacy tape inputs, no longer collected.
     */
    measurements: jsonb("measurements").$type<{
      waistIn?: number;
      waistReadings?: number[];
      neckIn?: number;
      hipIn?: number;
      abdomenIn?: number;
    }>(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
  },
  (t) => ({
    userIdx: index("weight_logs_user_idx").on(t.userId, t.recordedAt),
    planIdx: index("weight_logs_plan_idx").on(t.planId),
  }),
);

/** Chat with Groq about the plan — message log + which edits each turn applied. */
export const planChatMessages = pgTable(
  "plan_chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    /** Edit ops the assistant applied this turn (null for user messages or assistant messages with no edits). */
    appliedEdits: jsonb("applied_edits"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    planIdx: index("plan_chat_plan_idx").on(t.planId, t.createdAt),
    userIdx: index("plan_chat_user_idx").on(t.userId),
  }),
);

/**
 * One row per logged workout. Rows are written lazily — the row only exists
 * when the user marks the day done or records actuals. Source of truth for
 * the prescription is still plans.payload; this table snapshots what they
 * actually did.
 */
export const workouts = pgTable(
  "workouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekIndex: integer("week_index").notNull(), // 0-based
    dayOfWeek: integer("day_of_week").notNull(), // 0=Mon..6=Sun
    sessionType: text("session_type").notNull(),
    /** Snapshot of plan.payload's prescription at time of completion. */
    prescription: jsonb("prescription").notNull(),
    /** What the user actually did per exercise; null = not yet logged. */
    actuals: jsonb("actuals").$type<{
      exercises?: Array<{
        name: string;
        actualWeightLb?: number;
        actualReps?: string;
        skipped?: boolean;
        notes?: string;
      }>;
    }>(),
    /** RPE 1-10; null = not recorded. */
    rpe: integer("rpe"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedNotes: text("completed_notes"),
  },
  (t) => ({
    planIdx: index("workouts_plan_idx").on(t.planId),
    userIdx: index("workouts_user_idx").on(t.userId),
    planWeekDayUnique: uniqueIndex("workouts_plan_week_day_unique").on(
      t.planId,
      t.weekIndex,
      t.dayOfWeek,
    ),
  }),
);

/* ------------------------------------------------------------------ */
/* Units & roster (group AT PT) — first multi-tenant surface          */
/* ------------------------------------------------------------------ */

/** A unit an MFT/leader owns. AT window fields are set when planning AT PT. */
export const units = pgTable(
  "units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    /** The MFT/leader who created and owns the unit. */
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    atStartDate: timestamp("at_start_date", { withTimezone: true }),
    atDays: integer("at_days"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index("units_owner_idx").on(t.ownerUserId),
    // A given owner can't have two units with the same (case-insensitive) name.
    ownerNameUnique: uniqueIndex("units_owner_name_unique").on(
      t.ownerUserId,
      sql`lower(${t.name})`,
    ),
  }),
);

/**
 * A soldier on a unit's roster. Hybrid model: the MFT enters the member and a
 * baseline directly (no login needed); a soldier with an app account can later
 * *claim* the entry via `claimToken`, which sets `userId`. Baseline fields are
 * nullable so a member can be added before their scores are known.
 */
export const unitMembers = pgTable(
  "unit_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    /** Null until an app user claims this roster entry. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    role: text("role", { enum: ["mft", "member"] }).notNull().default("member"),

    // Baseline snapshot (nullable — MFT may add a member before baseline is known).
    age: integer("age"),
    sex: text("sex", { enum: ["MC", "F"] }),
    bodyweightLb: integer("bodyweight_lb"),
    heightIn: real("height_in"),
    mdlLb: integer("mdl_lb"),
    hrpReps: integer("hrp_reps"),
    sdcSec: integer("sdc_sec"),
    plkSec: integer("plk_sec"),
    twoMileSec: integer("two_mile_sec"),
    /** Go/No-Go result of the alternate aerobic event (profiled members). */
    alternateResult: text("alternate_result", { enum: ["go", "no_go"] }),

    /** Single-use claim token (crypto-random). Null once claimed/cleared. */
    claimToken: text("claim_token"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    unitIdx: index("unit_members_unit_idx").on(t.unitId),
    // A given app user links to a unit at most once.
    unitUserUnique: uniqueIndex("unit_members_unit_user_unique")
      .on(t.unitId, t.userId)
      .where(sql`${t.userId} IS NOT NULL`),
    claimTokenIdx: index("unit_members_claim_token_idx").on(t.claimToken),
  }),
);

/** A generated Annual Training group PT plan for a unit. One active per unit. */
export const atPlans = pgTable(
  "at_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    days: integer("days").notNull(),
    /** The generated AtPlan (schedule + ability groups + per-soldier cards). */
    payload: jsonb("payload").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    unitIdx: index("at_plans_unit_idx").on(t.unitId),
    activeUnique: uniqueIndex("at_plans_active_unique")
      .on(t.unitId)
      .where(sql`${t.active} = true`),
  }),
);
