CREATE TYPE "public"."action_source" AS ENUM('user', 'suggested');--> statement-breakpoint
CREATE TYPE "public"."action_status" AS ENUM('pending', 'done', 'skipped');--> statement-breakpoint
CREATE TABLE "goal_recurrence_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"period" "recurrence_period" NOT NULL,
	"target_frequency" integer NOT NULL,
	"replaced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ventures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ventures_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "daily_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"title" text NOT NULL,
	"category_id" uuid NOT NULL,
	"linked_goal_id" uuid,
	"is_standalone" boolean DEFAULT false NOT NULL,
	"venture_id" uuid,
	"priority" integer DEFAULT 3 NOT NULL,
	"source" "action_source" DEFAULT 'user' NOT NULL,
	"status" "action_status" DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_actions_goal_or_explicit_standalone" CHECK ("daily_actions"."linked_goal_id" is not null or "daily_actions"."is_standalone" = true)
);
--> statement-breakpoint
CREATE TABLE "daily_review_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"raw_text" text NOT NULL,
	"energy_rating" integer,
	"day_rating" integer,
	"replaced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"raw_text" text NOT NULL,
	"energy_rating" integer,
	"day_rating" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_reviews_date_unique" UNIQUE("date")
);
--> statement-breakpoint
ALTER TABLE "goal_recurrence_history" ADD CONSTRAINT "goal_recurrence_history_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_actions" ADD CONSTRAINT "daily_actions_category_id_life_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."life_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_actions" ADD CONSTRAINT "daily_actions_linked_goal_id_goals_id_fk" FOREIGN KEY ("linked_goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_actions" ADD CONSTRAINT "daily_actions_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "behavior_completions" ADD CONSTRAINT "behavior_completions_goal_date" UNIQUE("goal_id","date");