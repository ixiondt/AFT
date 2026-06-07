import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),

  // MFA scaffold (not enabled in V0 but column shape avoids painful future migration)
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  mfaSecretEncrypted: text("mfa_secret_encrypted"),
  mfaVerifiedAt: timestamp("mfa_verified_at", { withTimezone: true }),
  mfaBackupCodes: jsonb("mfa_backup_codes"),
});

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
    daysPerWeek: integer("days_per_week").notNull(), // 3-6
    equipment: jsonb("equipment").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    injuries: jsonb("injuries").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
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

/** One row per scheduled workout in the plan; mark complete as you go. */
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
    sessionType: text("session_type").notNull(), // "strength_a" | "intervals" | "tempo" | etc.
    prescription: jsonb("prescription").notNull(),
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
