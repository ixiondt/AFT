CREATE TABLE IF NOT EXISTS "at_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"days" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "at_plans" ADD CONSTRAINT "at_plans_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "at_plans_unit_idx" ON "at_plans" USING btree ("unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "at_plans_active_unique" ON "at_plans" USING btree ("unit_id") WHERE "at_plans"."active" = true;