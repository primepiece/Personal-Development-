CREATE TYPE "public"."score_confidence" AS ENUM('insufficient', 'low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."score_trend" AS ENUM('up', 'flat', 'down');--> statement-breakpoint
CREATE TYPE "public"."signal_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."signal_status" AS ENUM('active', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."signal_type" AS ENUM('priority_neglected', 'deadline_at_risk', 'adherence_declining', 'adherence_improving', 'consistency_streak', 'pillar_neglected', 'action_completion_falling', 'goal_completed');--> statement-breakpoint
CREATE TABLE "category_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"score" double precision,
	"confidence" "score_confidence" NOT NULL,
	"trend" "score_trend",
	"breakdown" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_signal_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signal_id" uuid NOT NULL,
	"ref_table" text NOT NULL,
	"ref_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "signal_type" NOT NULL,
	"severity" "signal_severity" NOT NULL,
	"category_id" uuid NOT NULL,
	"goal_id" uuid,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"status" "signal_status" DEFAULT 'active' NOT NULL,
	"evidence" jsonb NOT NULL,
	"narrative_text" text
);
--> statement-breakpoint
ALTER TABLE "category_scores" ADD CONSTRAINT "category_scores_category_id_life_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."life_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_signal_references" ADD CONSTRAINT "coach_signal_references_signal_id_coach_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."coach_signals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_signals" ADD CONSTRAINT "coach_signals_category_id_life_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."life_categories"("id") ON DELETE no action ON UPDATE no action;