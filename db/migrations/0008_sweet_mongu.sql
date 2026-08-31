CREATE TYPE "public"."morning_brief_status" AS ENUM('ok', 'failed');--> statement-breakpoint
CREATE TYPE "public"."morning_recommendation_status" AS ENUM('pending', 'accepted', 'edited_accepted', 'dismissed');--> statement-breakpoint
CREATE TABLE "morning_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"model" text NOT NULL,
	"status" "morning_brief_status" NOT NULL,
	"failure_reason" text,
	"evidence_bundle" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "morning_recommendation_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recommendation_id" uuid NOT NULL,
	"ref_table" text NOT NULL,
	"ref_id" uuid NOT NULL,
	"note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "morning_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brief_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"category_id" uuid NOT NULL,
	"linked_goal_id" uuid,
	"title" text NOT NULL,
	"reason" text NOT NULL,
	"status" "morning_recommendation_status" DEFAULT 'pending' NOT NULL,
	"edited_title" text,
	"resulting_action_id" uuid,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "morning_recommendation_references" ADD CONSTRAINT "morning_recommendation_references_recommendation_id_morning_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."morning_recommendations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "morning_recommendations" ADD CONSTRAINT "morning_recommendations_brief_id_morning_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."morning_briefs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "morning_recommendations" ADD CONSTRAINT "morning_recommendations_category_id_life_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."life_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "morning_recommendations" ADD CONSTRAINT "morning_recommendations_linked_goal_id_goals_id_fk" FOREIGN KEY ("linked_goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "morning_recommendations" ADD CONSTRAINT "morning_recommendations_resulting_action_id_daily_actions_id_fk" FOREIGN KEY ("resulting_action_id") REFERENCES "public"."daily_actions"("id") ON DELETE no action ON UPDATE no action;