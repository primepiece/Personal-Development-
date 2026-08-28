CREATE TYPE "public"."coach_brief_status" AS ENUM('ok', 'failed');--> statement-breakpoint
CREATE TABLE "coach_brief_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brief_id" uuid NOT NULL,
	"ref_table" text NOT NULL,
	"ref_id" uuid NOT NULL,
	"note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_start_date" date NOT NULL,
	"weekly_review_id" uuid NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"model" text NOT NULL,
	"status" "coach_brief_status" NOT NULL,
	"failure_reason" text,
	"evidence_bundle" jsonb NOT NULL,
	"summary" text,
	"progress" text,
	"concern" text,
	"contradiction" text,
	"recommendation" text,
	"next_week_priorities" jsonb,
	"confidence" text
);
--> statement-breakpoint
ALTER TABLE "coach_brief_references" ADD CONSTRAINT "coach_brief_references_brief_id_coach_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."coach_briefs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_briefs" ADD CONSTRAINT "coach_briefs_weekly_review_id_weekly_reviews_id_fk" FOREIGN KEY ("weekly_review_id") REFERENCES "public"."weekly_reviews"("id") ON DELETE no action ON UPDATE no action;