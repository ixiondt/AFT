CREATE TABLE IF NOT EXISTS "at_chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at_plan_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "at_chat_messages" ADD CONSTRAINT "at_chat_messages_at_plan_id_at_plans_id_fk" FOREIGN KEY ("at_plan_id") REFERENCES "public"."at_plans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "at_chat_messages" ADD CONSTRAINT "at_chat_messages_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "at_chat_messages" ADD CONSTRAINT "at_chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "at_chat_plan_idx" ON "at_chat_messages" USING btree ("at_plan_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "at_chat_unit_idx" ON "at_chat_messages" USING btree ("unit_id");