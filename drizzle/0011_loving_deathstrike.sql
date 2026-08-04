ALTER TABLE "aft_tests" ADD COLUMN IF NOT EXISTS "profile_context" jsonb;--> statement-breakpoint
ALTER TABLE "unit_members" ADD COLUMN IF NOT EXISTS "alternate_result" text;