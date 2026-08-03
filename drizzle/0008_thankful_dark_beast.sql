CREATE TABLE IF NOT EXISTS "medical_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"profile_type" text NOT NULL,
	"start_date" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"exempt_events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"alternate_aerobic" text DEFAULT 'none' NOT NULL,
	"restrictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lift_limit_lb" integer,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "medical_profiles" ADD CONSTRAINT "medical_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "medical_profiles_user_idx" ON "medical_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "medical_profiles_active_user_unique" ON "medical_profiles" USING btree ("user_id") WHERE "medical_profiles"."active" = true AND "medical_profiles"."user_id" IS NOT NULL;