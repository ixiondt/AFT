CREATE TABLE IF NOT EXISTS "unit_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"user_id" uuid,
	"display_name" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"age" integer,
	"sex" text,
	"bodyweight_lb" integer,
	"height_in" real,
	"mdl_lb" integer,
	"hrp_reps" integer,
	"sdc_sec" integer,
	"plk_sec" integer,
	"two_mile_sec" integer,
	"claim_token" text,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"at_start_date" timestamp with time zone,
	"at_days" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "medical_profiles" ADD COLUMN "unit_member_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_members" ADD CONSTRAINT "unit_members_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_members" ADD CONSTRAINT "unit_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "units" ADD CONSTRAINT "units_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unit_members_unit_idx" ON "unit_members" USING btree ("unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unit_members_unit_user_unique" ON "unit_members" USING btree ("unit_id","user_id") WHERE "unit_members"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unit_members_claim_token_idx" ON "unit_members" USING btree ("claim_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "units_owner_idx" ON "units" USING btree ("owner_user_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "medical_profiles" ADD CONSTRAINT "medical_profiles_unit_member_id_unit_members_id_fk" FOREIGN KEY ("unit_member_id") REFERENCES "public"."unit_members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "medical_profiles_member_idx" ON "medical_profiles" USING btree ("unit_member_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "medical_profiles_active_member_unique" ON "medical_profiles" USING btree ("unit_member_id") WHERE "medical_profiles"."active" = true AND "medical_profiles"."unit_member_id" IS NOT NULL;