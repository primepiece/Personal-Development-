CREATE TYPE "public"."goal_kind" AS ENUM('outcome', 'behavior');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('active', 'done', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."goal_tier" AS ENUM('milestone', 'annual', 'quarterly', 'monthly', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."recurrence_period" AS ENUM('day', 'week', 'month');--> statement-breakpoint
CREATE TABLE "life_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "life_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "vision_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"who_i_want_to_become" text DEFAULT '' NOT NULL,
	"life_looks_like" text DEFAULT '' NOT NULL,
	"long_term_targets" text DEFAULT '' NOT NULL,
	"why_it_matters" text DEFAULT '' NOT NULL,
	"refuse_to_become" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vision_entries_category_id_unique" UNIQUE("category_id")
);
--> statement-breakpoint
CREATE TABLE "vision_entry_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"who_i_want_to_become" text NOT NULL,
	"life_looks_like" text NOT NULL,
	"long_term_targets" text NOT NULL,
	"why_it_matters" text NOT NULL,
	"refuse_to_become" text NOT NULL,
	"replaced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"statement" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "behavior_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"date" date NOT NULL,
	"completed" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"title" text NOT NULL,
	"target_metric" text,
	"target_value" double precision,
	"target_date" date,
	"priority" integer NOT NULL,
	"status" "goal_status" NOT NULL,
	"replaced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_recurrence" (
	"goal_id" uuid PRIMARY KEY NOT NULL,
	"period" "recurrence_period" NOT NULL,
	"target_frequency" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_goal_id" uuid,
	"category_id" uuid NOT NULL,
	"tier" "goal_tier" NOT NULL,
	"kind" "goal_kind" DEFAULT 'outcome' NOT NULL,
	"milestone_age" integer,
	"title" text NOT NULL,
	"description" text,
	"target_metric" text,
	"target_value" double precision,
	"target_date" date,
	"priority" integer DEFAULT 3 NOT NULL,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vision_entries" ADD CONSTRAINT "vision_entries_category_id_life_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."life_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vision_entry_history" ADD CONSTRAINT "vision_entry_history_category_id_life_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."life_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standards" ADD CONSTRAINT "standards_category_id_life_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."life_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "behavior_completions" ADD CONSTRAINT "behavior_completions_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_history" ADD CONSTRAINT "goal_history_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_recurrence" ADD CONSTRAINT "goal_recurrence_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_parent_goal_id_goals_id_fk" FOREIGN KEY ("parent_goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_category_id_life_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."life_categories"("id") ON DELETE no action ON UPDATE no action;